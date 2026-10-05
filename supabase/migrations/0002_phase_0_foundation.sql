-- Migration 0002: Phase 0 and 1 Foundation Schema and Security

-- 1. Profiles: add role, updated_at trigger, drop client write policies
alter table public.profiles
  add column if not exists role text not null default 'user' check (role in ('admin', 'user'));

-- Updated_at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Drop legacy client profile insert/update policies from 0001
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

-- Ensure own-profile select is preserved
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- 2. Profile creation trigger on auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_name text;
begin
  raw_name := coalesce(
    new.raw_user_meta_data->>'displayName',
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (
    id,
    display_name,
    timezone,
    role,
    created_at,
    updated_at
  )
  values (
    new.id,
    nullif(trim(raw_name), ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'timezone'), ''), 'Asia/Ho_Chi_Minh'),
    'user',
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Scoped RPC to update own profile display name and timezone only (role is immutable by client)
create or replace function public.update_my_profile(
  new_display_name text default null,
  new_timezone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_record public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set
    display_name = coalesce(nullif(trim(new_display_name), ''), display_name),
    timezone = coalesce(nullif(trim(new_timezone), ''), timezone),
    updated_at = now()
  where id = auth.uid()
  returning * into updated_record;

  return updated_record;
end;
$$;

-- 3. Tasks: drop old constraint, normalize status to in_progress, add new check constraint, add recurrence_rule
alter table public.tasks drop constraint if exists tasks_status_check;
update public.tasks set status = 'in_progress' where status = 'doing';
alter table public.tasks add constraint tasks_status_check
  check (status in ('todo', 'in_progress', 'done'));

alter table public.tasks add column if not exists recurrence_rule text;

-- 4. Reminders: drop old constraint, normalize status to triggered, add new check constraint, add updated_at
alter table public.reminders drop constraint if exists reminders_status_check;
update public.reminders set status = 'triggered' where status = 'fired';
alter table public.reminders add constraint reminders_status_check
  check (status in ('pending', 'triggered', 'snoozed', 'dismissed'));

alter table public.reminders add column if not exists updated_at timestamptz not null default now();

-- 5. Categories: add updated_at
alter table public.categories add column if not exists updated_at timestamptz not null default now();

-- 6. Missing Indexes from Phase 0
create index if not exists idx_tasks_user_category on public.tasks(user_id, category_id);
create index if not exists idx_tasks_user_completed on public.tasks(user_id, completed_at);
create index if not exists idx_reminders_task on public.reminders(task_id);
create index if not exists idx_schedule_blocks_task on public.schedule_blocks(task_id);
create index if not exists idx_task_activities_user_created on public.task_activities(user_id, created_at);
create index if not exists idx_task_activities_task_created on public.task_activities(task_id, created_at);

-- 7. Ensure personal-data RLS remains strictly scoped to auth.uid() = user_id
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.reminders enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.task_activities enable row level security;

-- 8. Table and routine privileges for service_role, authenticated, and anon roles
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all routines in schema public to authenticated;
