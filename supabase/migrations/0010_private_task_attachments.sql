-- Migration: 0010_private_task_attachments.sql
-- Description: Create private task attachments metadata, bucket, and storage policies

-- 1. Create public.task_attachments table
create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  bucket text not null default 'task-attachments',
  object_path text,
  file_name text not null,
  mime_type text,
  byte_size bigint,
  kind text not null check (kind in ('file', 'link')),
  external_url text,
  checksum text,
  upload_status text not null default 'ready' check (upload_status in ('pending', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_attachments_kind_file_check check (
    (kind = 'file' and object_path is not null and byte_size is not null and byte_size <= 10485760) or
    (kind = 'link' and object_path is null and byte_size is null and external_url is not null and external_url ~* '^https?://.+')
  )
);

create index if not exists task_attachments_task_id_idx on public.task_attachments (task_id);
create index if not exists task_attachments_user_id_idx on public.task_attachments (user_id);

-- 2. Configure RLS on public.task_attachments
alter table public.task_attachments enable row level security;

create policy task_attachments_select_own on public.task_attachments
  for select using (auth.uid() = user_id and public.is_active_account());

create policy task_attachments_insert_own on public.task_attachments
  for insert with check (
    auth.uid() = user_id
    and public.is_active_account()
    and exists (
      select 1 from public.tasks
      where id = task_id
        and user_id = auth.uid()
        and deleted_at is null
    )
    and (
      (kind = 'file' and object_path is not null and split_part(object_path, '/', 1) = auth.uid()::text) or
      (kind = 'link' and object_path is null)
    )
  );

create policy task_attachments_update_own on public.task_attachments
  for update using (auth.uid() = user_id and public.is_active_account())
  with check (
    auth.uid() = user_id
    and public.is_active_account()
    and exists (
      select 1 from public.tasks
      where id = task_id
        and user_id = auth.uid()
        and deleted_at is null
    )
    and (
      (kind = 'file' and object_path is not null and split_part(object_path, '/', 1) = auth.uid()::text) or
      (kind = 'link' and object_path is null)
    )
  );

create policy task_attachments_delete_own on public.task_attachments
  for delete using (auth.uid() = user_id and public.is_active_account());

grant select, insert, update, delete on public.task_attachments to authenticated, service_role;

-- 3. Configure private bucket in storage.buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-attachments',
  'task-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

-- 4. Storage object policies for 'task-attachments' bucket
drop policy if exists "Task attachments owner select" on storage.objects;
create policy "Task attachments owner select"
  on storage.objects for select
  using (
    bucket_id = 'task-attachments'
    and split_part(name, '/', 1) = auth.uid()::text
    and public.is_active_account()
  );

drop policy if exists "Task attachments owner insert" on storage.objects;
create policy "Task attachments owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'task-attachments'
    and split_part(name, '/', 1) = auth.uid()::text
    and public.is_active_account()
  );

drop policy if exists "Task attachments owner update" on storage.objects;
create policy "Task attachments owner update"
  on storage.objects for update
  using (
    bucket_id = 'task-attachments'
    and split_part(name, '/', 1) = auth.uid()::text
    and public.is_active_account()
  );

drop policy if exists "Task attachments owner delete" on storage.objects;
create policy "Task attachments owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'task-attachments'
    and split_part(name, '/', 1) = auth.uid()::text
    and public.is_active_account()
  );

-- 4. Expose service-role only RPC wrapper for purge worker
create or replace function public.purge_task_internal(
  p_task_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Restrict execution to service_role only
  if coalesce(auth.role(), '') <> 'service_role'
     and coalesce(session_user, '') <> 'service_role'
     and coalesce(current_setting('role', true), '') <> 'service_role'
     and coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role' then
    raise exception 'Unauthorized: service_role privilege required' using errcode = '42501';
  end if;

  return tabdo_internal.purge_task_record(p_task_id, p_user_id);
end;
$$;

revoke all on function public.purge_task_internal(uuid, uuid) from public, anon, authenticated;
grant execute on function public.purge_task_internal(uuid, uuid) to service_role;

