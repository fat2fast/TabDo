-- Migration 0005: Phase 5 Reminder Engine, Integrity & Lifecycle Invariants

-- 1. Legacy data inventory and repair for reminders
do $$
declare
  dup_count int;
begin
  -- Clear snoozed_until on records with non-snoozed status
  update public.reminders
  set snoozed_until = null
  where status <> 'snoozed' and snoozed_until is not null;

  -- Convert invalid snoozed (missing snooze time or in the past) or past active rows to dismissed
  update public.reminders
  set status = 'dismissed', snoozed_until = null
  where (status = 'snoozed' and (snoozed_until is null or snoozed_until <= now()))
     or (status = 'pending' and remind_at <= now());

  -- Check for duplicate active reminders on the same (user_id, task_id, remind_at)
  select count(*) into dup_count from (
    select user_id, task_id, remind_at
    from public.reminders
    where status in ('pending', 'snoozed')
    group by user_id, task_id, remind_at
    having count(*) > 1
  ) duplicates;

  if dup_count > 0 then
    raise exception 'Migration aborted: % duplicate active reminder group(s) exist in public.reminders', dup_count;
  end if;
end $$;

-- 2. Add reminder_kind and offset_minutes columns
alter table public.reminders
  add column if not exists reminder_kind text not null default 'absolute',
  add column if not exists offset_minutes int;

-- Backfill any nulls
update public.reminders
set reminder_kind = 'absolute'
where reminder_kind is null;

-- Static constraints on kind and offset
alter table public.reminders
  add constraint reminders_kind_check check (reminder_kind in ('absolute', 'relative_due')),
  add constraint reminders_offset_check check (
    (reminder_kind = 'absolute' and offset_minutes is null) or
    (reminder_kind = 'relative_due' and offset_minutes is not null and offset_minutes >= 0)
  );

-- Generated effective_at column: coalesce(snoozed_until, remind_at)
alter table public.reminders
  add column if not exists effective_at timestamptz generated always as (coalesce(snoozed_until, remind_at)) stored;

-- Static constraint on snooze state vs status
alter table public.reminders
  add constraint reminders_snooze_status_check check (
    (status = 'snoozed' and snoozed_until is not null) or
    (status in ('pending', 'triggered', 'dismissed') and snoozed_until is null)
  );

-- 3. Ensure updated_at trigger exists
drop trigger if exists set_reminders_updated_at on public.reminders;
create trigger set_reminders_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

-- 4. Derive and validate reminder trigger function
create or replace function public.derive_and_validate_reminder()
returns trigger
language plpgsql
as $$
declare
  task_rec record;
  now_ts timestamptz := statement_timestamp();
begin
  -- Validate task ownership
  select user_id, due_at, due_date_kind into task_rec
  from public.tasks
  where id = new.task_id;

  if not found or task_rec.user_id <> new.user_id then
    raise exception 'Task does not belong to the same user' using errcode = '23503';
  end if;

  -- Operations: if triggered or dismissed, snooze is cleared
  if new.status in ('triggered', 'dismissed') then
    new.snoozed_until := null;
  end if;

  -- Relative reminder logic
  if new.reminder_kind = 'relative_due' and new.status in ('pending', 'snoozed') then
    if task_rec.due_at is null or task_rec.due_date_kind <> 'date_time' then
      raise exception 'Relative reminder requires a task with a timed due date' using errcode = '23514';
    end if;

    if new.offset_minutes is null or new.offset_minutes < 0 then
      raise exception 'Relative reminder requires a non-negative offset_minutes' using errcode = '23514';
    end if;

    -- Derive remind_at from task due_at and offset_minutes
    new.remind_at := task_rec.due_at - (new.offset_minutes * interval '1 minute');
  else
    -- Absolute reminder logic
    if new.reminder_kind = 'absolute' and new.offset_minutes is not null then
      raise exception 'Absolute reminder must have null offset_minutes' using errcode = '23514';
    end if;
  end if;

  -- Snooze validation: snoozed_until must be in the future
  if new.status = 'snoozed' then
    if new.snoozed_until is null or new.snoozed_until <= now_ts then
      raise exception 'Snoozed reminder must have snoozed_until in the future' using errcode = '23514';
    end if;
  end if;

  -- Active effective time validation: pending/snoozed effective_at must be in the future on insert or when time/status updated
  if new.status in ('pending', 'snoozed') then
    if coalesce(new.snoozed_until, new.remind_at) <= now_ts then
      raise exception 'Active reminder effective time must be in the future' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_derive_and_validate_reminder on public.reminders;
create trigger trg_derive_and_validate_reminder
  before insert or update on public.reminders
  for each row execute function public.derive_and_validate_reminder();

-- 5. Partial indexes
-- Partial unique index on active reminders by original configured time (remind_at)
create unique index if not exists idx_reminders_unique_active
  on public.reminders (user_id, task_id, remind_at)
  where status in ('pending', 'snoozed');

-- Partial index for 7-day upcoming queries
create index if not exists idx_reminders_user_effective_upcoming
  on public.reminders (user_id, effective_at)
  where status in ('pending', 'snoozed');

-- 6. Task lifecycle trigger: reconcile reminders on due-date or status change
create or replace function public.reconcile_task_reminders()
returns trigger
language plpgsql
as $$
declare
  now_ts timestamptz := statement_timestamp();
begin
  -- Task completion: dismiss all pending or snoozed reminders
  if new.status = 'done' and old.status <> 'done' then
    update public.reminders
    set
      status = 'dismissed',
      snoozed_until = null,
      updated_at = now_ts
    where task_id = new.id
      and status in ('pending', 'snoozed');
  end if;

  -- Task due date changes on non-done task
  if new.status <> 'done' and (new.due_at is distinct from old.due_at or new.due_date_kind is distinct from old.due_date_kind) then
    -- If due date was cleared or changed from date_time to date_only
    if new.due_at is null or new.due_date_kind <> 'date_time' then
      update public.reminders
      set
        status = 'dismissed',
        snoozed_until = null,
        updated_at = now_ts
      where task_id = new.id
        and reminder_kind = 'relative_due'
        and status in ('pending', 'snoozed');
    else
      -- Recalculate active relative reminders
      update public.reminders
      set
        status = case
          when (new.due_at - (offset_minutes * interval '1 minute')) <= now_ts then 'dismissed'
          else status
        end,
        snoozed_until = case
          when (new.due_at - (offset_minutes * interval '1 minute')) <= now_ts then null
          else snoozed_until
        end,
        remind_at = (new.due_at - (offset_minutes * interval '1 minute')),
        updated_at = now_ts
      where task_id = new.id
        and reminder_kind = 'relative_due'
        and status in ('pending', 'snoozed');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reconcile_task_reminders on public.tasks;
create trigger trg_reconcile_task_reminders
  after update of status, due_at, due_date_kind on public.tasks
  for each row execute function public.reconcile_task_reminders();
