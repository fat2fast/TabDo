-- Migration 0006: Admin Account Policies, Password Enforcement, Locale & Aggregate Privacy

-- 1. Profiles: add is_active, must_change_password, and locale
alter table public.profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists must_change_password boolean not null default false,
  add column if not exists locale text not null default 'vi';

alter table public.profiles
  drop constraint if exists profiles_locale_check;

alter table public.profiles
  add constraint profiles_locale_check check (locale in ('vi', 'en'));

-- Backfill existing profiles
update public.profiles set is_active = true where is_active is null;
update public.profiles set must_change_password = false where must_change_password is null;
update public.profiles set locale = 'vi' where locale is null;

-- Supported query indexes
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_is_active on public.profiles(is_active);

-- 2. Update handle_new_user() to populate locale and must_change_password from user metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_name text;
  raw_tz text;
  raw_locale text;
  raw_must_change boolean;
begin
  raw_name := coalesce(
    new.raw_user_meta_data->>'displayName',
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  raw_tz := coalesce(nullif(trim(new.raw_user_meta_data->>'timezone'), ''), 'Asia/Ho_Chi_Minh');

  raw_locale := coalesce(nullif(trim(new.raw_user_meta_data->>'locale'), ''), 'vi');
  if raw_locale not in ('vi', 'en') then
    raw_locale := 'vi';
  end if;

  raw_must_change := coalesce(
    (new.raw_user_meta_data->>'mustChangePassword')::boolean,
    (new.raw_user_meta_data->>'must_change_password')::boolean,
    false
  );

  insert into public.profiles (
    id,
    display_name,
    timezone,
    role,
    is_active,
    must_change_password,
    locale,
    created_at,
    updated_at
  )
  values (
    new.id,
    nullif(trim(raw_name), ''),
    raw_tz,
    'user',
    true,
    raw_must_change,
    raw_locale,
    now(),
    now()
  )
  on conflict (id) do update set
    is_active = excluded.is_active,
    must_change_password = excluded.must_change_password;

  return new;
end;
$$;

-- 3. Account-state helper for personal data RLS
create or replace function public.is_active_account()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (select (p.is_active is true and p.must_change_password is false)
     from public.profiles p
     where p.id = (select auth.uid())),
    false
  );
$$;

revoke all on function public.is_active_account() from public, anon;
grant execute on function public.is_active_account() to authenticated;

-- 4. Replace update_my_profile RPC to enforce active, non-forced caller and support locale
drop function if exists public.update_my_profile(text, text);
create or replace function public.update_my_profile(
  new_display_name text default null,
  new_timezone text default null,
  new_locale text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_active boolean;
  caller_forced boolean;
  updated_record public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select is_active, must_change_password into caller_active, caller_forced
  from public.profiles
  where id = auth.uid();

  if caller_active is distinct from true then
    raise exception 'Account is inactive';
  end if;

  if caller_forced is true then
    raise exception 'Password change required';
  end if;

  if new_locale is not null and new_locale not in ('vi', 'en') then
    raise exception 'Invalid locale: must be vi or en';
  end if;

  update public.profiles
  set
    display_name = coalesce(nullif(trim(new_display_name), ''), display_name),
    timezone = coalesce(nullif(trim(new_timezone), ''), timezone),
    locale = coalesce(nullif(trim(new_locale), ''), locale),
    updated_at = now()
  where id = auth.uid()
  returning * into updated_record;

  return updated_record;
end;
$$;

revoke all on function public.update_my_profile(text, text, text) from public, anon;
grant execute on function public.update_my_profile(text, text, text) to authenticated;

-- 5. Enforce account state in RLS policies for personal-data tables

-- Categories
drop policy if exists "categories_all_own" on public.categories;
create policy "categories_all_own" on public.categories
  for all
  using (auth.uid() = user_id and public.is_active_account())
  with check (auth.uid() = user_id and public.is_active_account());

-- Tasks
drop policy if exists "tasks_all_own" on public.tasks;
create policy "tasks_all_own" on public.tasks
  for all
  using (auth.uid() = user_id and public.is_active_account())
  with check (auth.uid() = user_id and public.is_active_account());

-- Reminders
drop policy if exists "reminders_all_own" on public.reminders;
create policy "reminders_all_own" on public.reminders
  for all
  using (auth.uid() = user_id and public.is_active_account())
  with check (auth.uid() = user_id and public.is_active_account());

-- Schedule Blocks
drop policy if exists "schedule_all_own" on public.schedule_blocks;
create policy "schedule_all_own" on public.schedule_blocks
  for all
  using (auth.uid() = user_id and public.is_active_account())
  with check (auth.uid() = user_id and public.is_active_account());

-- Task Activities
drop policy if exists "activities_all_own" on public.task_activities;
create policy "activities_all_own" on public.task_activities
  for all
  using (auth.uid() = user_id and public.is_active_account())
  with check (auth.uid() = user_id and public.is_active_account());

-- Ensure profiles read remains allowed for own-profile (minimal read even if inactive/forced)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select
  using (auth.uid() = id);

-- 6. Define service-only aggregate function (aggregates count all rows including subtasks)
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
set search_path = ''
as $$
  select
    p.id as user_id,
    coalesce(count(t.id), 0) as task_count,
    coalesce(count(t.id) filter (where t.status = 'todo'), 0) as todo_count,
    coalesce(count(t.id) filter (where t.status = 'in_progress'), 0) as in_progress_count,
    coalesce(count(t.id) filter (where t.status = 'done'), 0) as done_count
  from public.profiles p
  left join public.tasks t on t.user_id = p.id
  where (target_user_ids is null or p.id = any(target_user_ids))
  group by p.id;
$$;

revoke all on function public.get_user_task_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.get_user_task_counts(uuid[]) to service_role;
