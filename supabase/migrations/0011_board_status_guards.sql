-- Migration 0011: Board status guards
-- Prevents status updates on trashed tasks and blocks reopening recurring tasks that already have a successor occurrence.

create or replace function public.check_task_status_transition()
returns trigger
language plpgsql
as $$
declare
  has_successor boolean;
begin
  -- Only validate if status is actually changing
  if new.status is distinct from old.status then
    -- Block status change on trashed tasks
    if old.deleted_at is not null then
      raise exception 'Cannot change status of a deleted task' using errcode = '23514';
    end if;

    -- Block reopening completed recurring task if any successor occurrence exists (active or trashed)
    if old.status = 'done' and new.status in ('todo', 'in_progress') then
      select exists (
        select 1 from public.tasks
        where recurrence_parent_id = old.id
      ) into has_successor;

      if has_successor then
        raise exception 'Cannot reopen recurring task with existing successor'
          using errcode = '23514',
                detail = 'RECURRING_TASK_HAS_SUCCESSOR';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_task_status_transition on public.tasks;
create trigger trg_check_task_status_transition
  before update of status on public.tasks
  for each row execute function public.check_task_status_transition();
