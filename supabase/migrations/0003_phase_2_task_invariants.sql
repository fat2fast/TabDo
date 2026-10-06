-- Migration 0003: Phase 2 Task Invariants and Ownership Guards

-- 1. Tasks: add constraints on title, description, start_at/due_at
alter table public.tasks
  add constraint tasks_title_not_blank check (btrim(title) <> ''),
  add constraint tasks_title_length check (char_length(title) <= 500),
  add constraint tasks_description_length check (description is null or char_length(description) <= 10000),
  add constraint tasks_temporal_order check (start_at is null or due_at is null or start_at <= due_at);

-- 2. Tasks: add due_date_kind and priority_rank
alter table public.tasks
  add column if not exists due_date_kind text not null default 'date_time'
    check (due_date_kind in ('date_only', 'date_time')),
  add column if not exists priority_rank int generated always as (
    case priority
      when 'high' then 3
      when 'medium' then 2
      when 'low' then 1
      else 0
    end
  ) stored;

create index if not exists idx_tasks_user_priority_rank on public.tasks(user_id, priority_rank desc);

-- 3. Triggers for updated_at on tasks and categories
drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- 4. Ownership validation triggers
create or replace function public.check_task_ownership_and_hierarchy()
returns trigger
language plpgsql
as $$
declare
  cat_user_id uuid;
  parent_user_id uuid;
begin
  if new.parent_id is not null and new.parent_id = new.id then
    raise exception 'Task cannot be its own parent' using errcode = '23514';
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

  return new;
end;
$$;

drop trigger if exists trg_check_task_ownership on public.tasks;
create trigger trg_check_task_ownership
  before insert or update of user_id, category_id, parent_id on public.tasks
  for each row execute function public.check_task_ownership_and_hierarchy();

create or replace function public.check_task_activity_ownership()
returns trigger
language plpgsql
as $$
declare
  task_owner_id uuid;
begin
  if new.task_id is not null then
    select user_id into task_owner_id from public.tasks where id = new.task_id;
    if task_owner_id is null or task_owner_id <> new.user_id then
      raise exception 'Task activity task_id does not belong to the same user' using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_task_activity_ownership on public.task_activities;
create trigger trg_check_task_activity_ownership
  before insert or update of user_id, task_id on public.task_activities
  for each row execute function public.check_task_activity_ownership();
