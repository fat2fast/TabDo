-- Migration 0004: Phase 4 Schedule Blocks Schema & Invariants

-- 1. Legacy data inventory and repair for schedule_blocks
do $$
declare
  overlong_count int;
begin
  -- Check for titles exceeding 500 characters
  select count(*) into overlong_count
  from public.schedule_blocks
  where char_length(title) > 500;

  if overlong_count > 0 then
    raise exception 'Migration aborted: % schedule block(s) have title exceeding 500 characters', overlong_count;
  end if;

  -- Repair blank or null titles to deterministic fallback
  update public.schedule_blocks
  set title = 'Untitled schedule block'
  where title is null or btrim(title) = '';
end $$;

-- 2. Constraints on title (retaining end_at > start_at from 0001)
alter table public.schedule_blocks
  add constraint schedule_blocks_title_not_blank check (btrim(title) <> ''),
  add constraint schedule_blocks_title_length check (char_length(title) <= 500);

-- 3. Trigger for updated_at
drop trigger if exists set_schedule_blocks_updated_at on public.schedule_blocks;
create trigger set_schedule_blocks_updated_at
  before update on public.schedule_blocks
  for each row execute function public.set_updated_at();

-- 4. Cross-owner task reference validation trigger
create or replace function public.check_schedule_block_task_ownership()
returns trigger
language plpgsql
as $$
declare
  task_owner_id uuid;
begin
  if new.task_id is not null then
    select user_id into task_owner_id from public.tasks where id = new.task_id;
    if task_owner_id is null or task_owner_id <> new.user_id then
      raise exception 'Schedule block task_id does not belong to the same user' using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_schedule_block_task_ownership on public.schedule_blocks;
create trigger trg_check_schedule_block_task_ownership
  before insert or update of user_id, task_id on public.schedule_blocks
  for each row execute function public.check_schedule_block_task_ownership();
