-- Phase 10 security hardening: atomically claim purge candidates before object deletion.
-- Only service_role can invoke this RPC; never expose it to browser clients.
create or replace function public.claim_task_for_purge(p_task_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_at timestamptz;
  v_purge_status text;
begin
  select deleted_at, purge_status into v_deleted_at, v_purge_status
  from public.tasks
  where id = p_task_id and user_id = p_user_id
  for update;

  if not found or v_deleted_at is null then
    return false;
  end if;

  if not (v_deleted_at <= statement_timestamp() - interval '30 days'
          or v_purge_status in ('pending_purge', 'purging')) then
    return false;
  end if;

  -- restore_task refuses any non-null purge_status, so files cannot be restored
  -- while a claimed purge is deleting their private Storage objects.
  update public.tasks
  set purge_status = 'purging', updated_at = statement_timestamp()
  where id = p_task_id and user_id = p_user_id;
  return true;
end;
$$;

revoke all on function public.claim_task_for_purge(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_task_for_purge(uuid, uuid) to service_role;

-- Replace the internal delete guard: a restored/active task is NEVER hard-deleted.
-- The only valid caller is the orchestration worker after claim_task_for_purge.
create or replace function tabdo_internal.purge_task_record(p_task_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_id uuid;
begin
  select deletion_batch_id into v_batch_id
  from public.tasks
  where id = p_task_id and user_id = p_user_id
    and deleted_at is not null and purge_status = 'purging'
  for update;

  if not found then
    return false;
  end if;

  update public.tasks
  set parent_id = null
  where parent_id = p_task_id
    and user_id = p_user_id
    and (deletion_batch_id is distinct from v_batch_id or deleted_at is null);

  update public.tasks
  set parent_id = null
  where parent_id = p_task_id and user_id = p_user_id;

  update public.schedule_blocks
  set task_id = null
  where task_id = p_task_id and user_id = p_user_id;

  delete from public.reminders
  where task_id = p_task_id and user_id = p_user_id;

  delete from public.task_activities
  where task_id = p_task_id and user_id = p_user_id;

  delete from public.tasks
  where id = p_task_id and user_id = p_user_id;

  return true;
end;
$$;

-- The legacy DB-only batch helper bypasses Storage cleanup; disallow its use.
revoke execute on function tabdo_internal.purge_expired_tasks(int) from service_role;

-- Prevent recursive restore from reactivating a descendant whose files are being purged.
create or replace function tabdo_internal.reject_purging_restore()
returns trigger language plpgsql set search_path = '' as $guard$
begin
  if old.deleted_at is not null and new.deleted_at is null and old.purge_status is not null then
    raise exception 'Cannot restore a task that is being purged' using errcode = '22023';
  end if;
  if old.purge_status = 'purging' and new.purge_status is distinct from 'purging' then
    raise exception 'Cannot clear a claimed purge' using errcode = '22023';
  end if;
  return new;
end;
$guard$;
drop trigger if exists reject_purging_restore on public.tasks;
create trigger reject_purging_restore before update of deleted_at, purge_status
on public.tasks for each row execute function tabdo_internal.reject_purging_restore();

-- New file metadata must point to its owning task. Keep historical rows for
-- controlled cleanup; the worker also validates paths before deletion.
alter table public.task_attachments
add constraint task_attachment_scoped_object_path check (
  kind <> 'file' or (
    bucket = 'task-attachments'
    and split_part(object_path, '/', 1) = user_id::text
    and split_part(object_path, '/', 2) = task_id::text
    and split_part(object_path, '/', 3) <> ''
  )
) not valid;

-- Retry scheduling and exclusive claim bookkeeping for purge workers.
alter table public.tasks
  add column if not exists purge_claim_token uuid,
  add column if not exists purge_claimed_at timestamptz,
  add column if not exists purge_retry_after timestamptz,
  add column if not exists purge_attempt_count integer not null default 0;

-- Find candidates that are due. Retry-deferred tasks cannot starve newer work.
create or replace function public.purge_due_candidates(p_limit integer default 50)
returns table(id uuid, user_id uuid)
language sql stable security definer set search_path = '' as $candidates$
  select t.id, t.user_id
  from public.tasks t
  where t.deleted_at is not null
    and (
      t.deleted_at <= statement_timestamp() - interval '30 days'
      or t.purge_status in ('pending_purge', 'purging')
    )
    and (t.purge_retry_after is null or t.purge_retry_after <= statement_timestamp())
    and (
      t.purge_status is distinct from 'purging'
      or t.purge_claimed_at is null
      or t.purge_claimed_at <= statement_timestamp() - interval '30 minutes'
    )
  -- Put retried failures behind previously unattempted eligible tasks.
  order by coalesce(t.purge_retry_after, t.deleted_at), t.id
  limit least(greatest(coalesce(p_limit, 50), 1), 50);
$candidates$;
revoke all on function public.purge_due_candidates(integer) from public, anon, authenticated;
grant execute on function public.purge_due_candidates(integer) to service_role;

-- Every invocation uses a fresh UUID. Row locking makes claims exclusive.
create or replace function public.claim_task_for_purge(
  p_task_id uuid, p_user_id uuid, p_claim_token uuid
) returns boolean
language plpgsql security definer set search_path = '' as $claim$
declare
  v_task public.tasks%rowtype;
  v_now timestamptz := statement_timestamp();
begin
  if p_claim_token is null then return false; end if;
  select * into v_task from public.tasks
  where id = p_task_id and user_id = p_user_id for update;
  if not found or v_task.deleted_at is null then return false; end if;
  if v_task.purge_retry_after is not null and v_task.purge_retry_after > v_now then
    return false;
  end if;
  if v_task.purge_status = 'purging' and v_task.purge_claimed_at is not null
     and v_task.purge_claimed_at > v_now - interval '30 minutes' then
    return false;
  end if;
  if not (v_task.deleted_at <= v_now - interval '30 days'
      or v_task.purge_status in ('pending_purge', 'purging')) then
    return false;
  end if;
  update public.tasks set purge_status = 'purging',
    purge_claim_token = p_claim_token, purge_claimed_at = v_now,
    purge_retry_after = null, updated_at = v_now
  where id = p_task_id and user_id = p_user_id;
  return true;
end;
$claim$;
revoke all on function public.claim_task_for_purge(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_task_for_purge(uuid, uuid, uuid) to service_role;
-- Old two-argument claim is unfenced: retire it.
revoke all on function public.claim_task_for_purge(uuid, uuid)
  from public, anon, authenticated, service_role;

-- Fence each Storage batch and metadata change to the current claim holder.
create or replace function public.is_purge_claim_current(
  p_task_id uuid, p_user_id uuid, p_claim_token uuid
) returns boolean language sql stable security definer set search_path = '' as $current$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id and t.user_id = p_user_id
      and t.deleted_at is not null and t.purge_status = 'purging'
      and t.purge_claim_token = p_claim_token
      and t.purge_claimed_at > statement_timestamp() - interval '30 minutes'
  );
$current$;
revoke all on function public.is_purge_claim_current(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.is_purge_claim_current(uuid, uuid, uuid) to service_role;

-- Failed tasks remain in Trash, retrying after bounded exponential backoff.
create or replace function public.defer_task_purge(
  p_task_id uuid, p_user_id uuid, p_claim_token uuid
) returns boolean language plpgsql security definer set search_path = '' as $defer$
declare
  v_attempts integer;
begin
  select purge_attempt_count into v_attempts
  from public.tasks
  where id = p_task_id and user_id = p_user_id
    and deleted_at is not null and purge_status = 'purging'
    and purge_claim_token = p_claim_token
  for update;
  if not found then return false; end if;
  update public.tasks
  set purge_attempt_count = least(v_attempts + 1, 1000),
      purge_retry_after = statement_timestamp()
        + least(24, power(2, least(v_attempts, 5))::integer) * interval '1 hour',
      purge_claimed_at = null, purge_claim_token = null,
      updated_at = statement_timestamp()
  where id = p_task_id and user_id = p_user_id;
  return true;
end;
$defer$;
revoke all on function public.defer_task_purge(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.defer_task_purge(uuid, uuid, uuid) to service_role;

-- Legacy two-argument delete RPC does not check claim ownership.
revoke all on function public.purge_task_internal(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function tabdo_internal.purge_task_record(uuid, uuid)
  from public, anon, authenticated, service_role;

-- Fence final deletion under a task row lock; only a live token may purge.
create or replace function public.purge_task_internal(
  p_task_id uuid, p_user_id uuid, p_claim_token uuid
) returns boolean language plpgsql security definer set search_path = '' as $purge$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and coalesce(session_user, '') <> 'service_role'
     and coalesce(current_setting('role', true), '') <> 'service_role'
     and coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role' then
    raise exception 'Unauthorized: service_role privilege required' using errcode = '42501';
  end if;
  perform 1 from public.tasks
  where id = p_task_id and user_id = p_user_id
    and deleted_at is not null and purge_status = 'purging'
    and purge_claim_token = p_claim_token
    and purge_claimed_at > statement_timestamp() - interval '30 minutes'
  for update;
  if not found then return false; end if;
  return tabdo_internal.purge_task_record(p_task_id, p_user_id);
end;
$purge$;
revoke all on function public.purge_task_internal(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.purge_task_internal(uuid, uuid, uuid) to service_role;
