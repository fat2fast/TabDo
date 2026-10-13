-- Migration 0009: Owned Task Trash Lifecycle, Soft-Delete & Durable Purge

-- 1. Add lifecycle columns and indexes to public.tasks
alter table public.tasks
  add column if not exists deleted_at timestamptz null,
  add column if not exists deletion_batch_id uuid null,
  add column if not exists purge_status text null;

-- Add trashed_status to public.reminders to preserve state across trash/restore
alter table public.reminders
  add column if not exists trashed_status text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_purge_status_check'
  ) then
    alter table public.tasks
      add constraint tasks_purge_status_check
      check (purge_status is null or purge_status in ('pending_purge', 'purging'));
  end if;
end $$;

create index if not exists idx_tasks_user_deleted_at
  on public.tasks (user_id, deleted_at);

create index if not exists idx_tasks_deletion_batch
  on public.tasks (deletion_batch_id)
  where deletion_batch_id is not null;

create index if not exists idx_tasks_purge_status
  on public.tasks (purge_status)
  where purge_status is not null;

-- 2. Revoke direct DELETE on tasks from client roles
revoke delete on table public.tasks from anon, authenticated;

-- Replace permissive tasks policy with separate granular policies
drop policy if exists "tasks_all_own" on public.tasks;

-- Owners can SELECT their own tasks (including trashed tasks for trash inspection/recovery)
drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own" on public.tasks
  for select
  using (auth.uid() = user_id and public.is_active_account());

-- Owners can INSERT active tasks only
drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks
  for insert
  with check (
    auth.uid() = user_id
    and public.is_active_account()
    and deleted_at is null
    and deletion_batch_id is null
    and purge_status is null
  );

-- Owners can UPDATE active tasks only; direct updates to lifecycle columns or trashed tasks are forbidden
drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own" on public.tasks
  for update
  using (
    auth.uid() = user_id
    and public.is_active_account()
    and deleted_at is null
    and purge_status is null
  )
  with check (
    auth.uid() = user_id
    and public.is_active_account()
    and deleted_at is null
    and deletion_batch_id is null
    and purge_status is null
  );

-- 3. Create non-exposed internal schema for privileged purge operations
create schema if not exists tabdo_internal;
revoke all on schema tabdo_internal from public, anon, authenticated;
grant usage on schema tabdo_internal to service_role;

-- Core purge execution function in tabdo_internal
create or replace function tabdo_internal.purge_task_record(
  p_task_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_id uuid;
  v_task_found boolean := false;
begin
  -- Lock task row under user ownership
  select deletion_batch_id into v_batch_id
  from public.tasks
  where id = p_task_id and user_id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  -- Before deleting parent, preserve any independently trashed or active subtasks
  -- by detaching them from parent_id so cascade delete does not inadvertently destroy them.
  update public.tasks
  set parent_id = null
  where parent_id = p_task_id
    and user_id = p_user_id
    and (deletion_batch_id is distinct from v_batch_id or deleted_at is null);

  -- For subtasks in the same deletion batch, detach parent_id before deletion as well
  update public.tasks
  set parent_id = null
  where parent_id = p_task_id
    and user_id = p_user_id;

  -- Detach schedule blocks so they remain as standalone calendar blocks
  update public.schedule_blocks
  set task_id = null
  where task_id = p_task_id and user_id = p_user_id;

  -- Delete associated reminders and task activities
  delete from public.reminders
  where task_id = p_task_id and user_id = p_user_id;

  delete from public.task_activities
  where task_id = p_task_id and user_id = p_user_id;

  -- Hard delete the task row
  delete from public.tasks
  where id = p_task_id and user_id = p_user_id;

  return true;
end;
$$;

revoke all on function tabdo_internal.purge_task_record(uuid, uuid) from public, anon, authenticated;
grant execute on function tabdo_internal.purge_task_record(uuid, uuid) to service_role;

-- 4. Scheduled purge worker helper for tasks aged >= 30 days
create or replace function tabdo_internal.purge_expired_tasks(
  p_batch_size int default 50
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_purged int := 0;
begin
  for r in (
    select id, user_id
    from public.tasks
    where (
      deleted_at <= statement_timestamp() - interval '30 days'
      or purge_status = 'pending_purge'
    )
    order by deleted_at asc nulls last
    limit p_batch_size
  ) loop
    if tabdo_internal.purge_task_record(r.id, r.user_id) then
      v_purged := v_purged + 1;
    end if;
  end loop;

  return v_purged;
end;
$$;

revoke all on function tabdo_internal.purge_expired_tasks(int) from public, anon, authenticated;
grant execute on function tabdo_internal.purge_expired_tasks(int) to service_role;

-- 5. User-facing RPCs: trash_task, restore_task, request_purge_task
create or replace function public.trash_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_batch_id uuid := gen_random_uuid();
  v_now timestamptz := statement_timestamp();
  v_task public.tasks%rowtype;
begin
  if v_caller_id is null or not public.is_active_account() then
    raise exception 'Unauthorized or inactive account' using errcode = '42501';
  end if;

  select * into v_task
  from public.tasks
  where id = p_task_id and user_id = v_caller_id
  for update;

  if not found then
    raise exception 'Task not found or access denied' using errcode = 'P0002';
  end if;

  if v_task.deleted_at is not null then
    return jsonb_build_object(
      'success', true,
      'batch_id', v_task.deletion_batch_id,
      'already_trashed', true
    );
  end if;

  -- Soft delete the target task
  update public.tasks
  set deleted_at = v_now,
      deletion_batch_id = v_batch_id,
      updated_at = v_now
  where id = p_task_id and user_id = v_caller_id;

  -- Recursively soft delete active descendants with the same batch ID
  with recursive descendants as (
    select id
    from public.tasks
    where parent_id = p_task_id
      and user_id = v_caller_id
      and deleted_at is null
    union all
    select t.id
    from public.tasks t
    join descendants d on t.parent_id = d.id
    where t.user_id = v_caller_id
      and t.deleted_at is null
  )
  update public.tasks
  set deleted_at = v_now,
      deletion_batch_id = v_batch_id,
      updated_at = v_now
  where id in (select id from descendants);

  -- Dismiss active reminders for this task and its batch descendants, saving prior status
  with recursive descendants_all as (
    select id
    from public.tasks
    where parent_id = p_task_id
      and user_id = v_caller_id
      and deletion_batch_id = v_batch_id
    union all
    select t.id
    from public.tasks t
    join descendants_all d on t.parent_id = d.id
    where t.user_id = v_caller_id
      and t.deletion_batch_id = v_batch_id
  )
  update public.reminders
  set trashed_status = status,
      status = 'dismissed',
      snoozed_until = null,
      updated_at = v_now
  where (
    task_id = p_task_id
    or task_id in (select id from descendants_all)
  )
  and user_id = v_caller_id
  and status in ('pending', 'snoozed');

  -- Record activity
  insert into public.task_activities (user_id, task_id, action, metadata, created_at)
  values (
    v_caller_id,
    p_task_id,
    'trashed',
    jsonb_build_object('batch_id', v_batch_id),
    v_now
  );

  return jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id
  );
end;
$$;

revoke all on function public.trash_task(uuid) from public, anon;
grant execute on function public.trash_task(uuid) to authenticated;

create or replace function public.restore_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  v_task public.tasks%rowtype;
  v_batch_id uuid;
  v_parent_deleted_at timestamptz;
  v_new_parent_id uuid;
begin
  if v_caller_id is null or not public.is_active_account() then
    raise exception 'Unauthorized or inactive account' using errcode = '42501';
  end if;

  select * into v_task
  from public.tasks
  where id = p_task_id and user_id = v_caller_id
  for update;

  if not found then
    raise exception 'Task not found or access denied' using errcode = 'P0002';
  end if;

  if v_task.deleted_at is null then
    return jsonb_build_object('success', true, 'already_active', true);
  end if;

  if v_task.purge_status is not null then
    raise exception 'Cannot restore a task that is being purged' using errcode = '22023';
  end if;

  v_batch_id := v_task.deletion_batch_id;
  v_new_parent_id := v_task.parent_id;

  -- If parent is still in trash, detach parent_id so restored subtask is visible in active list
  if v_new_parent_id is not null then
    select deleted_at into v_parent_deleted_at
    from public.tasks
    where id = v_new_parent_id and user_id = v_caller_id;

    if v_parent_deleted_at is not null then
      v_new_parent_id := null;
    end if;
  end if;

  -- Restore target task
  update public.tasks
  set deleted_at = null,
      deletion_batch_id = null,
      purge_status = null,
      parent_id = v_new_parent_id,
      updated_at = v_now
  where id = p_task_id and user_id = v_caller_id;

  -- Recursively restore exactly the descendants that were trashed in the same batch
  if v_batch_id is not null then
    with recursive batch_descendants as (
      select id
      from public.tasks
      where parent_id = p_task_id
        and user_id = v_caller_id
        and deletion_batch_id = v_batch_id
      union all
      select t.id
      from public.tasks t
      join batch_descendants d on t.parent_id = d.id
      where t.user_id = v_caller_id
        and t.deletion_batch_id = v_batch_id
    )
    update public.tasks
    set deleted_at = null,
        deletion_batch_id = null,
        purge_status = null,
        updated_at = v_now
    where id in (select id from batch_descendants);
  end if;

  -- Restore reminders that were dismissed when task was trashed, if remind_at is still in future
  with recursive all_restored_tasks as (
    select id
    from public.tasks
    where id = p_task_id and user_id = v_caller_id
    union all
    select t.id
    from public.tasks t
    join all_restored_tasks a on t.parent_id = a.id
    where t.user_id = v_caller_id
  )
  update public.reminders
  set status = trashed_status,
      trashed_status = null,
      updated_at = v_now
  where task_id in (select id from all_restored_tasks)
    and user_id = v_caller_id
    and trashed_status is not null
    and status = 'dismissed'
    and remind_at > v_now;

  -- Clear trashed_status on past/expired reminders
  with recursive all_restored_tasks_past as (
    select id
    from public.tasks
    where id = p_task_id and user_id = v_caller_id
    union all
    select t.id
    from public.tasks t
    join all_restored_tasks_past a on t.parent_id = a.id
    where t.user_id = v_caller_id
  )
  update public.reminders
  set trashed_status = null,
      updated_at = v_now
  where task_id in (select id from all_restored_tasks_past)
    and user_id = v_caller_id
    and trashed_status is not null
    and status = 'dismissed'
    and remind_at <= v_now;

  -- Record activity
  insert into public.task_activities (user_id, task_id, action, metadata, created_at)
  values (v_caller_id, p_task_id, 'restored', '{}'::jsonb, v_now);

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.restore_task(uuid) from public, anon;
grant execute on function public.restore_task(uuid) to authenticated;

create or replace function public.request_purge_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_task public.tasks%rowtype;
begin
  if v_caller_id is null or not public.is_active_account() then
    raise exception 'Unauthorized or inactive account' using errcode = '42501';
  end if;

  select * into v_task
  from public.tasks
  where id = p_task_id and user_id = v_caller_id
  for update;

  if not found then
    raise exception 'Task not found or access denied' using errcode = 'P0002';
  end if;

  if v_task.deleted_at is null then
    raise exception 'Cannot purge a task that is not in Trash' using errcode = '22023';
  end if;

  -- Record request as pending_purge so purge worker cleans Storage objects first
  update public.tasks
  set purge_status = 'pending_purge',
      updated_at = clock_timestamp()
  where id = p_task_id and user_id = v_caller_id;

  if v_task.deletion_batch_id is not null then
    with recursive batch_descendants as (
      select id from public.tasks
      where parent_id = p_task_id
        and user_id = v_caller_id
        and deletion_batch_id = v_task.deletion_batch_id
      union all
      select t.id from public.tasks t
      join batch_descendants d on t.parent_id = d.id
      where t.user_id = v_caller_id
        and t.deletion_batch_id = v_task.deletion_batch_id
    )
    update public.tasks
    set purge_status = 'pending_purge',
        updated_at = clock_timestamp()
    where id in (select id from batch_descendants);
  end if;

  return jsonb_build_object('success', true, 'status', 'pending_purge');
end;
$$;

revoke all on function public.request_purge_task(uuid) from public, anon;
grant execute on function public.request_purge_task(uuid) to authenticated;

-- 6. Update complete_task_and_generate_next:
-- - Prevent completing trashed tasks
-- - Strip attachment comments from successor descriptions
create or replace function public.complete_task_and_generate_next(
  p_task_id uuid,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  caller_id uuid := auth.uid();
  v_task public.tasks%rowtype;
  v_successor public.tasks%rowtype;
  v_now timestamptz := statement_timestamp();
  v_next_id uuid;
  v_next_desc text;
  v_calc record;
  v_offsets int[];
  v_offset_val int;
  v_remind_at timestamptz;
  v_rem_status text;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Lock row under caller ownership
  select * into v_task
  from public.tasks
  where id = p_task_id and user_id = caller_id
  for update;

  if not found then
    raise exception 'Task not found or access denied' using errcode = 'P0002';
  end if;

  -- Prevent completing a trashed task
  if v_task.deleted_at is not null then
    raise exception 'Cannot complete a deleted task' using errcode = '22023';
  end if;

  -- Idempotency: if already done, return existing successor
  if v_task.status = 'done' then
    select * into v_successor
    from public.tasks
    where recurrence_parent_id = v_task.id and user_id = caller_id;

    if found then
      return jsonb_build_object(
        'completedTask', row_to_json(v_task),
        'nextTask', row_to_json(v_successor),
        'generated', false,
        'reusedExistingSuccessor', true
      );
    else
      return jsonb_build_object(
        'completedTask', row_to_json(v_task),
        'nextTask', null,
        'generated', false,
        'reusedExistingSuccessor', false
      );
    end if;
  end if;

  -- Optimistic concurrency check for pending completion
  if p_expected_updated_at is null then
    raise exception 'expected_updated_at is required' using errcode = '23514';
  end if;

  if v_task.updated_at is distinct from p_expected_updated_at then
    raise exception 'Task was modified concurrently (expected updated_at mismatch)' using errcode = '40001';
  end if;

  -- Snapshot relative reminder offsets before completion dismisses them
  select array_agg(offset_minutes) into v_offsets
  from public.reminders
  where task_id = v_task.id
    and user_id = caller_id
    and reminder_kind = 'relative_due'
    and offset_minutes is not null;

  -- Mark current task done (triggers trg_reconcile_task_reminders to dismiss old reminders)
  update public.tasks
  set
    status = 'done',
    completed_at = v_now,
    updated_at = v_now
  where id = v_task.id
  returning * into v_task;

  -- Record task completed activity
  insert into public.task_activities (user_id, task_id, action, metadata, created_at)
  values (caller_id, v_task.id, 'completed', jsonb_build_object('status', 'done'), v_now);

  -- If not recurring, we are done
  if v_task.recurrence_rule is null then
    return jsonb_build_object(
      'completedTask', row_to_json(v_task),
      'nextTask', null,
      'generated', false,
      'reusedExistingSuccessor', false
    );
  end if;

  -- Calculate next occurrence
  select next_due_at, next_start_at into v_calc
  from public.calculate_next_task_occurrence(
    v_task.due_at,
    v_task.due_date_kind,
    v_task.recurrence_rule,
    v_task.recurrence_timezone,
    v_task.recurrence_anchor_at,
    v_task.start_at
  );

  v_next_id := gen_random_uuid();
  -- Reset checklist items and explicitly strip legacy attachment comments
  v_next_desc := regexp_replace(
    public.reset_checklist_in_description(v_task.description),
    '<!--\s*tabdo_attachments:[\s\S]*?-->',
    '',
    'g'
  );

  -- Insert successor task with clean lifecycle state
  insert into public.tasks (
    id,
    user_id,
    category_id,
    parent_id,
    title,
    description,
    status,
    priority,
    due_date_kind,
    start_at,
    due_at,
    source_url,
    recurrence_rule,
    recurrence_series_id,
    recurrence_parent_id,
    recurrence_timezone,
    recurrence_anchor_at,
    deleted_at,
    deletion_batch_id,
    purge_status,
    created_at,
    updated_at
  ) values (
    v_next_id,
    caller_id,
    v_task.category_id,
    v_task.parent_id,
    v_task.title,
    v_next_desc,
    'todo',
    v_task.priority,
    v_task.due_date_kind,
    v_calc.next_start_at,
    v_calc.next_due_at,
    v_task.source_url,
    v_task.recurrence_rule,
    v_task.recurrence_series_id,
    v_task.id,
    v_task.recurrence_timezone,
    v_task.recurrence_anchor_at,
    null,
    null,
    null,
    v_now,
    v_now
  )
  returning * into v_successor;

  -- Copy relative reminders for date_time tasks
  if v_successor.due_date_kind = 'date_time' and v_offsets is not null then
    foreach v_offset_val in array v_offsets loop
      v_remind_at := v_successor.due_at - (v_offset_val * interval '1 minute');
      v_rem_status := case when v_remind_at > v_now then 'pending' else 'dismissed' end;

      insert into public.reminders (
        user_id,
        task_id,
        reminder_kind,
        offset_minutes,
        remind_at,
        status,
        created_at,
        updated_at
      ) values (
        caller_id,
        v_successor.id,
        'relative_due',
        v_offset_val,
        v_remind_at,
        v_rem_status,
        v_now,
        v_now
      );
    end loop;
  end if;

  return jsonb_build_object(
    'completedTask', row_to_json(v_task),
    'nextTask', row_to_json(v_successor),
    'generated', true,
    'reusedExistingSuccessor', false
  );
end;
$$;

revoke execute on function public.complete_task_and_generate_next(uuid, timestamptz) from public, anon;
grant execute on function public.complete_task_and_generate_next(uuid, timestamptz) to authenticated;

-- 7. Update get_user_task_counts to exclude trashed tasks from active user counts
create or replace function public.get_user_task_counts(target_user_ids uuid[] default null)
returns table (
  user_id uuid,
  task_count bigint,
  todo_count bigint,
  in_progress_count bigint,
  done_count bigint
)
language sql
security definer
as $$
  select
    u.id as user_id,
    coalesce(count(t.id) filter (where t.deleted_at is null), 0) as task_count,
    coalesce(count(t.id) filter (where t.status = 'todo' and t.deleted_at is null), 0) as todo_count,
    coalesce(count(t.id) filter (where t.status = 'in_progress' and t.deleted_at is null), 0) as in_progress_count,
    coalesce(count(t.id) filter (where t.status = 'done' and t.deleted_at is null), 0) as done_count
  from auth.users u
  left join public.tasks t on t.user_id = u.id
  where target_user_ids is null or u.id = any(target_user_ids)
  group by u.id;
$$;

revoke all on function public.get_user_task_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.get_user_task_counts(uuid[]) to service_role;
