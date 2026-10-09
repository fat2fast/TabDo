-- Migration 0007: Phase 7 Recurring Tasks & Occurrence Lifecycle

-- 1. Add recurrence columns to public.tasks
alter table public.tasks
  add column if not exists recurrence_series_id uuid,
  add column if not exists recurrence_parent_id uuid references public.tasks(id) on delete set null,
  add column if not exists recurrence_timezone text,
  add column if not exists recurrence_anchor_at timestamptz;

-- 2. Recurrence rule validation helper function
create or replace function public.is_valid_recurrence_rule(rule text)
returns boolean
language plpgsql immutable
as $$
declare
  trimmed text;
  days_part text;
  days text[];
  day_item text;
  allowed text[] := array['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  last_idx int := -1;
  cur_idx int;
begin
  if rule is null then
    return true;
  end if;
  trimmed := btrim(rule);
  if trimmed in ('FREQ=DAILY', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 'FREQ=WEEKLY', 'FREQ=MONTHLY') then
    return true;
  end if;
  if not (trimmed ~ '^FREQ=WEEKLY;BYDAY=[A-Z,]+$') then
    return false;
  end if;
  days_part := substring(trimmed from '^FREQ=WEEKLY;BYDAY=(.+)$');
  days := string_to_array(days_part, ',');
  if array_length(days, 1) is null or array_length(days, 1) > 7 then
    return false;
  end if;
  foreach day_item in array days loop
    cur_idx := array_position(allowed, day_item);
    if cur_idx is null or cur_idx <= last_idx then
      return false;
    end if;
    last_idx := cur_idx;
  end loop;
  return true;
end;
$$;

-- 3. Invariants constraint on tasks
alter table public.tasks
  add constraint tasks_recurrence_rule_valid check (public.is_valid_recurrence_rule(recurrence_rule)),
  add constraint tasks_recurrence_invariants check (
    (recurrence_rule is null and recurrence_series_id is null and recurrence_parent_id is null and recurrence_timezone is null and recurrence_anchor_at is null)
    or
    (recurrence_rule is not null and due_at is not null and recurrence_series_id is not null and recurrence_timezone is not null and recurrence_anchor_at is not null)
  );

-- 4. Extend task ownership & hierarchy trigger to check recurrence_parent_id
create or replace function public.check_task_ownership_and_hierarchy()
returns trigger
language plpgsql
as $$
declare
  cat_user_id uuid;
  parent_user_id uuid;
  rec_parent_user_id uuid;
begin
  if new.parent_id is not null and new.parent_id = new.id then
    raise exception 'Task cannot be its own parent' using errcode = '23514';
  end if;

  if new.recurrence_parent_id is not null and new.recurrence_parent_id = new.id then
    raise exception 'Task cannot be its own recurrence parent' using errcode = '23514';
  end if;

  if new.category_id is not null then
    select user_id into cat_user_id from public.categories where id = new.category_id;
    if cat_user_id is null or cat_user_id <> new.user_id then
      raise exception 'Category does not belong to the same user' using errcode = '23503';
    end if;
  end if;

  if new.parent_id is not null then
    select user_id into parent_user_id from public.tasks where id = new.parent_id;
    if parent_user_id is null or parent_user_id <> new.user_id then
      raise exception 'Parent task does not belong to the same user' using errcode = '23503';
    end if;
  end if;

  if new.recurrence_parent_id is not null then
    select user_id into rec_parent_user_id from public.tasks where id = new.recurrence_parent_id;
    if rec_parent_user_id is null or rec_parent_user_id <> new.user_id then
      raise exception 'Recurrence parent task does not belong to the same user' using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_task_ownership on public.tasks;
create trigger trg_check_task_ownership
  before insert or update of user_id, category_id, parent_id, recurrence_parent_id on public.tasks
  for each row execute function public.check_task_ownership_and_hierarchy();

-- 5. Indexes
create unique index if not exists idx_tasks_unique_recurrence_parent
  on public.tasks (recurrence_parent_id)
  where recurrence_parent_id is not null;

create index if not exists idx_tasks_user_recurrence_series
  on public.tasks (user_id, recurrence_series_id)
  where recurrence_series_id is not null;

-- 6. Helper: reset checklist completion flags in description
create or replace function public.reset_checklist_in_description(p_desc text)
returns text
language plpgsql immutable
as $$
declare
  res text := p_desc;
begin
  if res is null or res = '' then
    return res;
  end if;

  -- Reset JSON checklist completion: "completed":true -> "completed":false
  res := regexp_replace(res, '"completed"\s*:\s*true', '"completed":false', 'g');

  -- Reset legacy markdown checkboxes: - [x] or - [X] -> - [ ]
  res := regexp_replace(res, '- \[[xX]\] ', '- [ ] ', 'g');

  return res;
end;
$$;

-- 7. Helper: calculate next occurrence in PostgreSQL
create or replace function public.calculate_next_task_occurrence(
  p_due_at timestamptz,
  p_due_date_kind text,
  p_rule text,
  p_timezone text,
  p_anchor_at timestamptz,
  p_start_at timestamptz
)
returns table(next_due_at timestamptz, next_start_at timestamptz)
language plpgsql immutable
as $$
declare
  v_tz text := coalesce(nullif(btrim(p_timezone), ''), 'Asia/Ho_Chi_Minh');
  v_local_due timestamp;
  v_anchor_local timestamp;
  v_cur_year int;
  v_cur_month int;
  v_cur_dow int;
  v_anchor_day int;
  v_days_to_add int := 1;
  v_next_local timestamp;
  v_next_year int;
  v_next_month int;
  v_days_in_month int;
  v_target_day int;
  v_time_part time;
  v_diff interval;
  v_days_part text;
  v_days text[];
  v_allowed_dows int[] := array[]::int[];
  v_day_item text;
  v_step int;
begin
  v_local_due := p_due_at at time zone v_tz;
  v_anchor_local := coalesce(p_anchor_at, p_due_at) at time zone v_tz;

  v_cur_year := extract(year from v_local_due);
  v_cur_month := extract(month from v_local_due);
  v_cur_dow := extract(dow from v_local_due);
  v_anchor_day := extract(day from v_anchor_local);

  if p_rule = 'FREQ=DAILY' then
    v_next_local := v_local_due + interval '1 day';
  elsif p_rule = 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' then
    if v_cur_dow = 5 then
      v_days_to_add := 3;
    elsif v_cur_dow = 6 then
      v_days_to_add := 2;
    elsif v_cur_dow = 0 then
      v_days_to_add := 1;
    else
      v_days_to_add := 1;
    end if;
    v_next_local := v_local_due + (v_days_to_add * interval '1 day');
  elsif p_rule = 'FREQ=WEEKLY' then
    v_next_local := v_local_due + interval '7 days';
  elsif p_rule = 'FREQ=MONTHLY' then
    if v_cur_month = 12 then
      v_next_year := v_cur_year + 1;
      v_next_month := 1;
    else
      v_next_year := v_cur_year;
      v_next_month := v_cur_month + 1;
    end if;
    v_days_in_month := extract(day from (make_date(v_next_year, v_next_month, 1) + interval '1 month' - interval '1 day'));
    v_target_day := least(v_anchor_day, v_days_in_month);
    v_time_part := v_local_due::time;
    v_next_local := make_date(v_next_year, v_next_month, v_target_day) + v_time_part;
  elsif p_rule ~ '^FREQ=WEEKLY;BYDAY=[A-Z,]+$' then
    v_days_part := substring(p_rule from '^FREQ=WEEKLY;BYDAY=(.+)$');
    v_days := string_to_array(v_days_part, ',');
    foreach v_day_item in array v_days loop
      if v_day_item = 'SU' then v_allowed_dows := array_append(v_allowed_dows, 0);
      elsif v_day_item = 'MO' then v_allowed_dows := array_append(v_allowed_dows, 1);
      elsif v_day_item = 'TU' then v_allowed_dows := array_append(v_allowed_dows, 2);
      elsif v_day_item = 'WE' then v_allowed_dows := array_append(v_allowed_dows, 3);
      elsif v_day_item = 'TH' then v_allowed_dows := array_append(v_allowed_dows, 4);
      elsif v_day_item = 'FR' then v_allowed_dows := array_append(v_allowed_dows, 5);
      elsif v_day_item = 'SA' then v_allowed_dows := array_append(v_allowed_dows, 6);
      end if;
    end loop;
    v_days_to_add := 1;
    for v_step in 1..7 loop
      if ((v_cur_dow + v_step) % 7) = any(v_allowed_dows) then
        v_days_to_add := v_step;
        exit;
      end if;
    end loop;
    v_next_local := v_local_due + (v_days_to_add * interval '1 day');
  else
    raise exception 'Unsupported recurrence rule: %', p_rule using errcode = '23514';
  end if;

  if p_due_date_kind = 'date_only' then
    next_due_at := ((v_next_local::date + time '23:59:59.999') at time zone v_tz);
  else
    next_due_at := (v_next_local at time zone v_tz);
  end if;

  if p_start_at is not null then
    v_diff := p_due_at - p_start_at;
    next_start_at := next_due_at - v_diff;
  else
    next_start_at := null;
  end if;

  return next;
end;
$$;

-- 8. Atomic completion & successor creation RPC
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
  v_next_desc := public.reset_checklist_in_description(v_task.description);

  -- Insert successor task
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
    created_at,
    updated_at
  ) values (
    v_next_id,
    caller_id,
    v_task.category_id,
    null,
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
    v_now,
    v_now
  )
  returning * into v_successor;

  -- Record activity for successor creation
  insert into public.task_activities (user_id, task_id, action, metadata, created_at)
  values (
    caller_id,
    v_successor.id,
    'next_occurrence_generated',
    jsonb_build_object(
      'parent_task_id', v_task.id,
      'series_id', v_task.recurrence_series_id
    ),
    v_now
  );

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

-- 9. Execution grants
revoke execute on function public.complete_task_and_generate_next(uuid, timestamptz) from public, anon;
grant execute on function public.complete_task_and_generate_next(uuid, timestamptz) to authenticated;
