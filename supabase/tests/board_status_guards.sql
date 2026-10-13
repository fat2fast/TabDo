begin;
select plan(8);

-- Ensure test users exist
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'usera@tabdo.local', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"displayName":"User A"}', now(), now()),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'userb@tabdo.local', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"displayName":"User B"}', now(), now())
on conflict do nothing;

-- Setup test tasks as superuser / service role
set local role postgres;

-- Task 1: Non-recurring completed task for User A
insert into public.tasks (id, user_id, title, status, completed_at, created_at, updated_at)
values ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Solo Completed Task', 'done', now(), now(), now())
on conflict (id) do nothing;

-- Task 2: Recurring completed source task for User A with existing successor Task 3
insert into public.tasks (id, user_id, title, status, recurrence_rule, recurrence_series_id, recurrence_timezone, recurrence_anchor_at, due_at, completed_at, created_at, updated_at)
values ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Recurring Source Done', 'done', 'FREQ=DAILY', 'e0000000-0000-0000-0000-000000000002', 'Asia/Ho_Chi_Minh', now(), now(), now(), now(), now())
on conflict (id) do nothing;

insert into public.tasks (id, user_id, title, status, recurrence_rule, recurrence_series_id, recurrence_parent_id, recurrence_timezone, recurrence_anchor_at, due_at, created_at, updated_at)
values ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Recurring Successor Todo', 'todo', 'FREQ=DAILY', 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'Asia/Ho_Chi_Minh', now(), now() + interval '1 day', now(), now())
on conflict (id) do nothing;

-- Task 4: Trashed task for User A
insert into public.tasks (id, user_id, title, status, deleted_at, created_at, updated_at)
values ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Trashed Task', 'todo', now(), now(), now())
on conflict (id) do nothing;

-- Task 5: Active task for User B
insert into public.tasks (id, user_id, title, status, created_at, updated_at)
values ('e0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'User B Task', 'todo', now(), now())
on conflict (id) do nothing;

-- Impersonate User A
set local role authenticated;
set local "request.jwt.claim.sub" to 'a0000000-0000-0000-0000-000000000001';

-- Test 1: User A cannot update User B's task status (0 rows updated)
update public.tasks set status = 'in_progress' where id = 'e0000000-0000-0000-0000-000000000005';
select is(
  (select status from public.tasks where id = 'e0000000-0000-0000-0000-000000000005'),
  null,
  'User A cannot select or update User B task status under RLS'
);

-- Test 2: Source task without successor can be reopened (done -> in_progress)
update public.tasks set status = 'in_progress', completed_at = null where id = 'e0000000-0000-0000-0000-000000000001';
select is(
  (select status from public.tasks where id = 'e0000000-0000-0000-0000-000000000001'),
  'in_progress',
  'Source task without successor can transition from done to in_progress'
);

-- Test 3: Can transition in_progress -> todo
update public.tasks set status = 'todo' where id = 'e0000000-0000-0000-0000-000000000001';
select is(
  (select status from public.tasks where id = 'e0000000-0000-0000-0000-000000000001'),
  'todo',
  'Active task can transition between in_progress and todo'
);

-- Test 4: Recurring source task with existing successor cannot be reopened (done -> todo)
select throws_matching(
  $$ update public.tasks set status = 'todo' where id = 'e0000000-0000-0000-0000-000000000002' $$,
  'Cannot reopen recurring task with existing successor',
  'Trigger raises exception when reopening recurring task that already has a successor'
);

-- Test 5: Recurring source task with existing successor cannot transition done -> in_progress
select throws_matching(
  $$ update public.tasks set status = 'in_progress' where id = 'e0000000-0000-0000-0000-000000000002' $$,
  'Cannot reopen recurring task with existing successor',
  'Trigger raises exception when transitioning done to in_progress for recurring task with successor'
);

-- Test 6: Authenticated user cannot update trashed task (RLS policy matches 0 rows)
update public.tasks set status = 'in_progress' where id = 'e0000000-0000-0000-0000-000000000004';
select is(
  (select status from public.tasks where id = 'e0000000-0000-0000-0000-000000000004'),
  'todo',
  'Authenticated user cannot update trashed task status under RLS; status remains todo'
);


-- Test 7: Direct status update on trashed task triggers exception
set local role postgres;
select throws_matching(
  $$ update public.tasks set status = 'in_progress' where id = 'e0000000-0000-0000-0000-000000000004' $$,
  'Cannot change status of a deleted task',
  'Trigger raises exception when attempting to change status of a trashed task'
);

-- Test 8: Even if successor task is trashed, source task cannot be reopened
update public.tasks set deleted_at = now() where id = 'e0000000-0000-0000-0000-000000000003';
set local role authenticated;
set local "request.jwt.claim.sub" to 'a0000000-0000-0000-0000-000000000001';

select throws_matching(
  $$ update public.tasks set status = 'todo' where id = 'e0000000-0000-0000-0000-000000000002' $$,
  'Cannot reopen recurring task with existing successor',
  'Successor in trash still prevents reopening recurring source task'
);

select * from finish();
rollback;
