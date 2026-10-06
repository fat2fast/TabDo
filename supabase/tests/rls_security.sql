begin;
select plan(46);

-- 1. Table existence and RLS active tests (12 tests)
select has_table('public', 'profiles', 'Profiles table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'Profiles has RLS enabled');

select has_table('public', 'categories', 'Categories table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.categories'::regclass), 'Categories has RLS enabled');

select has_table('public', 'tasks', 'Tasks table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), 'Tasks has RLS enabled');

select has_table('public', 'reminders', 'Reminders table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.reminders'::regclass), 'Reminders has RLS enabled');

select has_table('public', 'schedule_blocks', 'Schedule blocks table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.schedule_blocks'::regclass), 'Schedule blocks has RLS enabled');

select has_table('public', 'task_activities', 'Task activities table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.task_activities'::regclass), 'Task activities has RLS enabled');

-- Setup test users
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'usera@tabdo.local', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"displayName":"User A"}', now(), now()),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'userb@tabdo.local', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"displayName":"User B"}', now(), now()),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_admin@tabdo.local', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"displayName":"Admin User"}', now(), now())
on conflict do nothing;

-- 2. New user trigger tests (2 tests)
select ok(
  exists(select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000001' and display_name = 'User A'),
  'Trigger handle_new_user automatically creates profile for User A'
);
select is(
  (select role from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'),
  'user',
  'Trigger creates profile with default role user'
);

-- Elevate Admin user via trusted backend update
update public.profiles set role = 'admin' where id = 'c0000000-0000-0000-0000-000000000003';

-- 3. Profile role immutability & RPC tests (3 tests)
-- Impersonate User A
set local role authenticated;
set local "request.jwt.claim.sub" to 'a0000000-0000-0000-0000-000000000001';

-- Attempt direct update of profile role - must affect 0 rows
update public.profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000001';
select is(
  (select role from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'),
  'user',
  'Direct client update cannot escalate profile role to admin'
);

-- Call update_my_profile RPC
select public.update_my_profile('User A Renamed', 'Asia/Bangkok');
select is(
  (select display_name from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'),
  'User A Renamed',
  'update_my_profile RPC updates display_name'
);
select is(
  (select role from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'),
  'user',
  'update_my_profile RPC preserves user role'
);

-- Reset to postgres role to set up tasks and categories
set local role postgres;
insert into public.categories (id, user_id, name)
values
  ('ca000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'User A Cat'),
  ('cb000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'User B Cat')
on conflict (id) do nothing;

insert into public.tasks (id, user_id, title, status, priority, category_id)
values ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'User A Secret Task', 'todo', 'high', 'ca000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.task_activities (user_id, task_id, action, metadata)
values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'created', '{"title":"User A Secret Task"}'::jsonb);

-- 4. Owner isolation on personal-data tables (4 tests)
-- User A context
set local role authenticated;
set local "request.jwt.claim.sub" to 'a0000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.tasks where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'User A can see their own task'
);

-- User B context
set local "request.jwt.claim.sub" to 'b0000000-0000-0000-0000-000000000002';

select is_empty(
  'select * from public.tasks where id = ''11111111-1111-1111-1111-111111111111''',
  'User B cannot select User A task'
);

update public.tasks set title = 'Hacked Task' where id = '11111111-1111-1111-1111-111111111111';
set local role postgres;
select is(
  (select title from public.tasks where id = '11111111-1111-1111-1111-111111111111'),
  'User A Secret Task',
  'User B cannot update User A task'
);

set local role authenticated;
set local "request.jwt.claim.sub" to 'b0000000-0000-0000-0000-000000000002';
delete from public.tasks where id = '11111111-1111-1111-1111-111111111111';
set local role postgres;
select ok(
  exists(select 1 from public.tasks where id = '11111111-1111-1111-1111-111111111111'),
  'User B cannot delete User A task'
);

-- 5. Admin cross-user denial (1 test)
-- Even with role = 'admin', personal records are isolated by auth.uid() = user_id
set local role authenticated;
set local "request.jwt.claim.sub" to 'c0000000-0000-0000-0000-000000000003';

select is_empty(
  'select * from public.tasks where id = ''11111111-1111-1111-1111-111111111111''',
  'Admin cannot select User A personal task through client API'
);

-- 6. Status check constraint tests (4 tests)
set local role postgres;

select lives_ok(
  $$insert into public.tasks (user_id, title, status) values ('a0000000-0000-0000-0000-000000000001', 'Valid In Progress', 'in_progress')$$,
  'Task status in_progress is valid under tasks_status_check'
);

select throws_ok(
  $$insert into public.tasks (user_id, title, status) values ('a0000000-0000-0000-0000-000000000001', 'Legacy Doing', 'doing')$$,
  '23514',
  NULL,
  'Legacy task status doing is rejected by tasks_status_check'
);

select lives_ok(
  $$insert into public.reminders (user_id, task_id, remind_at, status) values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', now(), 'triggered')$$,
  'Reminder status triggered is valid under reminders_status_check'
);

select throws_ok(
  $$insert into public.reminders (user_id, task_id, remind_at, status) values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', now(), 'fired')$$,
  '23514',
  NULL,
  'Legacy reminder status fired is rejected by reminders_status_check'
);

-- 7. Task domain constraints from Phase 1 (6 tests)
select throws_ok(
  $$insert into public.tasks (user_id, title) values ('a0000000-0000-0000-0000-000000000001', '   ')$$,
  '23514',
  NULL,
  'Blank task title is rejected'
);

select throws_ok(
  $$insert into public.tasks (user_id, title) values ('a0000000-0000-0000-0000-000000000001', repeat('x', 501))$$,
  '23514',
  NULL,
  'Task title over 500 characters is rejected'
);

select throws_ok(
  $$insert into public.tasks (user_id, title, description) values ('a0000000-0000-0000-0000-000000000001', 'Valid', repeat('x', 10001))$$,
  '23514',
  NULL,
  'Task description over 10000 characters is rejected'
);

select throws_ok(
  $$insert into public.tasks (user_id, title, start_at, due_at) values ('a0000000-0000-0000-0000-000000000001', 'Valid', now() + interval '2 days', now() + interval '1 day')$$,
  '23514',
  NULL,
  'start_at after due_at is rejected'
);

select throws_ok(
  $$insert into public.tasks (user_id, title, due_date_kind) values ('a0000000-0000-0000-0000-000000000001', 'Valid', 'invalid_kind')$$,
  '23514',
  NULL,
  'Invalid due_date_kind is rejected'
);

select lives_ok(
  $$insert into public.tasks (user_id, title, due_date_kind) values ('a0000000-0000-0000-0000-000000000001', 'Valid Date Only', 'date_only')$$,
  'due_date_kind date_only is accepted'
);

-- 8. Priority rank generated column tests (3 tests)
insert into public.tasks (id, user_id, title, priority)
values
  ('22222222-2222-2222-2222-222222222221', 'a0000000-0000-0000-0000-000000000001', 'High Rank Task', 'high'),
  ('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000001', 'Medium Rank Task', 'medium'),
  ('22222222-2222-2222-2222-222222222223', 'a0000000-0000-0000-0000-000000000001', 'Low Rank Task', 'low')
on conflict (id) do nothing;

select is(
  (select priority_rank from public.tasks where id = '22222222-2222-2222-2222-222222222221'),
  3,
  'High priority maps to priority_rank = 3'
);
select is(
  (select priority_rank from public.tasks where id = '22222222-2222-2222-2222-222222222222'),
  2,
  'Medium priority maps to priority_rank = 2'
);
select is(
  (select priority_rank from public.tasks where id = '22222222-2222-2222-2222-222222222223'),
  1,
  'Low priority maps to priority_rank = 1'
);

-- 9. Updated_at triggers on tasks and categories (2 tests)
update public.categories set name = 'User A Cat Updated' where id = 'ca000000-0000-0000-0000-000000000001';
select ok(
  (select updated_at from public.categories where id = 'ca000000-0000-0000-0000-000000000001') is not null,
  'Updating category sets updated_at'
);

update public.tasks set title = 'User A Secret Task Updated' where id = '11111111-1111-1111-1111-111111111111';
select ok(
  (select updated_at from public.tasks where id = '11111111-1111-1111-1111-111111111111') is not null,
  'Updating task sets updated_at'
);

-- 10. Ownership reference triggers (5 tests)
-- Cross-owner category
select throws_ok(
  $$insert into public.tasks (user_id, title, category_id) values ('a0000000-0000-0000-0000-000000000001', 'Bad Cat Task', 'cb000000-0000-0000-0000-000000000002')$$,
  '23503',
  NULL,
  'Cross-owner category on task is rejected'
);

-- Cross-owner parent
select throws_ok(
  $$insert into public.tasks (user_id, title, parent_id) values ('b0000000-0000-0000-0000-000000000002', 'Bad Child Task', '11111111-1111-1111-1111-111111111111')$$,
  '23503',
  NULL,
  'Cross-owner parent task reference is rejected'
);

-- Self-parent task
select throws_ok(
  $$update public.tasks set parent_id = '11111111-1111-1111-1111-111111111111' where id = '11111111-1111-1111-1111-111111111111'$$,
  '23514',
  NULL,
  'Task cannot be its own parent'
);

-- Cross-owner task activity
select throws_ok(
  $$insert into public.task_activities (user_id, task_id, action) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'tampered')$$,
  '23503',
  NULL,
  'Cross-owner task activity is rejected'
);

-- Category deletion sets task category_id to null and preserves task
insert into public.categories (id, user_id, name)
values ('ca000000-0000-0000-0000-000000000099', 'a0000000-0000-0000-0000-000000000001', 'To Delete')
on conflict (id) do nothing;

insert into public.tasks (id, user_id, title, category_id)
values ('33333333-3333-3333-3333-333333333333', 'a0000000-0000-0000-0000-000000000001', 'Task in To Delete Cat', 'ca000000-0000-0000-0000-000000000099')
on conflict (id) do nothing;

delete from public.categories where id = 'ca000000-0000-0000-0000-000000000099';

select is(
  (select category_id from public.tasks where id = '33333333-3333-3333-3333-333333333333'),
  NULL,
  'Deleting category sets tasks.category_id to null and preserves task'
);

-- 11. Category & Activity cross-user isolation (4 tests)
-- User B cannot select User A category
set local role authenticated;
set local "request.jwt.claim.sub" to 'b0000000-0000-0000-0000-000000000002';

select is_empty(
  'select * from public.categories where id = ''ca000000-0000-0000-0000-000000000001''',
  'User B cannot select User A category'
);

-- Admin cannot select User A category
set local "request.jwt.claim.sub" to 'c0000000-0000-0000-0000-000000000003';
select is_empty(
  'select * from public.categories where id = ''ca000000-0000-0000-0000-000000000001''',
  'Admin cannot select User A category'
);

-- User B cannot select User A task activity
set local "request.jwt.claim.sub" to 'b0000000-0000-0000-0000-000000000002';
select is_empty(
  'select * from public.task_activities where task_id = ''11111111-1111-1111-1111-111111111111''',
  'User B cannot select User A task activities'
);

-- Admin cannot select User A task activity
set local "request.jwt.claim.sub" to 'c0000000-0000-0000-0000-000000000003';
select is_empty(
  'select * from public.task_activities where task_id = ''11111111-1111-1111-1111-111111111111''',
  'Admin cannot select User A task activities'
);

select * from finish();
rollback;
