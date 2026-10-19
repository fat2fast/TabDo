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
