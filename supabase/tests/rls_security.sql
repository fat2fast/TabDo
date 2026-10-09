begin;
select plan(108);

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

-- 12. Schedule Blocks domain constraints, ownership, RLS, and FK behavior (11 tests)
set local role postgres;

-- Domain constraints
select throws_ok(
  $$insert into public.schedule_blocks (user_id, title, start_at, end_at) values ('a0000000-0000-0000-0000-000000000001', '   ', '2026-10-06 09:00:00+00', '2026-10-06 10:00:00+00')$$,
  '23514',
  NULL,
  'Blank schedule block title is rejected'
);

select throws_ok(
  $$insert into public.schedule_blocks (user_id, title, start_at, end_at) values ('a0000000-0000-0000-0000-000000000001', repeat('s', 501), '2026-10-06 09:00:00+00', '2026-10-06 10:00:00+00')$$,
  '23514',
  NULL,
  'Schedule block title over 500 characters is rejected'
);

select throws_ok(
  $$insert into public.schedule_blocks (user_id, title, start_at, end_at) values ('a0000000-0000-0000-0000-000000000001', 'Invalid Time Order', '2026-10-06 10:00:00+00', '2026-10-06 09:00:00+00')$$,
  '23514',
  NULL,
  'Schedule block with end_at <= start_at is rejected'
);

-- Cross-owner task reference
select throws_ok(
  $$insert into public.schedule_blocks (user_id, task_id, title, start_at, end_at) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Cross Owner Task Block', '2026-10-06 09:00:00+00', '2026-10-06 10:00:00+00')$$,
  '23503',
  NULL,
  'Cross-owner task reference on schedule block is rejected'
);

-- Insert valid schedule block for User A
insert into public.schedule_blocks (id, user_id, task_id, title, start_at, end_at)
values ('44444444-4444-4444-4444-444444444441', 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'User A Study Session', '2026-10-06 09:00:00+00', '2026-10-06 10:00:00+00')
on conflict (id) do nothing;

-- Updated_at trigger test
update public.schedule_blocks set title = 'User A Study Session Renamed' where id = '44444444-4444-4444-4444-444444444441';
select ok(
  (select updated_at from public.schedule_blocks where id = '44444444-4444-4444-4444-444444444441') is not null,
  'Updating schedule block sets updated_at'
);

-- RLS: User A can see their own schedule block
set local role authenticated;
set local "request.jwt.claim.sub" to 'a0000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.schedule_blocks where id = '44444444-4444-4444-4444-444444444441'),
  1,
  'User A can see their own schedule block'
);

-- RLS: User B cannot select User A schedule block
set local "request.jwt.claim.sub" to 'b0000000-0000-0000-0000-000000000002';
select is_empty(
  'select * from public.schedule_blocks where id = ''44444444-4444-4444-4444-444444444441''',
  'User B cannot select User A schedule block'
);

-- RLS: User B cannot update User A schedule block
update public.schedule_blocks set title = 'Hacked Schedule' where id = '44444444-4444-4444-4444-444444444441';
set local role postgres;
select is(
  (select title from public.schedule_blocks where id = '44444444-4444-4444-4444-444444444441'),
  'User A Study Session Renamed',
  'User B cannot update User A schedule block'
);

-- RLS: User B cannot delete User A schedule block
set local role authenticated;
set local "request.jwt.claim.sub" to 'b0000000-0000-0000-0000-000000000002';
delete from public.schedule_blocks where id = '44444444-4444-4444-4444-444444444441';
set local role postgres;
select ok(
  exists(select 1 from public.schedule_blocks where id = '44444444-4444-4444-4444-444444444441'),
  'User B cannot delete User A schedule block'
);

-- Admin cross-user denial
set local role authenticated;
set local "request.jwt.claim.sub" to 'c0000000-0000-0000-0000-000000000003';
select is_empty(
  'select * from public.schedule_blocks where id = ''44444444-4444-4444-4444-444444444441''',
  'Admin cannot select User A schedule block'
);

-- Task deletion sets schedule_blocks.task_id to null and preserves the schedule block
set local role postgres;
insert into public.tasks (id, user_id, title)
values ('55555555-5555-5555-5555-555555555555', 'a0000000-0000-0000-0000-000000000001', 'Task to Delete')
on conflict (id) do nothing;

insert into public.schedule_blocks (id, user_id, task_id, title, start_at, end_at)
values ('55555555-5555-5555-5555-555555555551', 'a0000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'Linked to Deleted Task', '2026-10-06 14:00:00+00', '2026-10-06 15:00:00+00')
on conflict (id) do nothing;

delete from public.tasks where id = '55555555-5555-5555-5555-555555555555';

select is(
  (select task_id from public.schedule_blocks where id = '55555555-5555-5555-5555-555555555551'),
  NULL,
  'Deleting task sets schedule_blocks.task_id to null and preserves schedule block'
);

-- 13. Reminder integrity, lifecycle triggers, RLS, and reconciliation (17 tests)
set local role postgres;

-- Fixture task for User A with timed due date
insert into public.tasks (id, user_id, title, status, due_at, due_date_kind)
values ('66666666-6666-6666-6666-666666666661', 'a0000000-0000-0000-0000-000000000001', 'Task for Reminders', 'todo', now() + interval '3 hours', 'date_time')
on conflict (id) do nothing;

-- 1. Cross-owner reminder task reference rejected
select throws_ok(
  $$insert into public.reminders (user_id, task_id, remind_at, status) values ('b0000000-0000-0000-0000-000000000002', '66666666-6666-6666-6666-666666666661', now() + interval '1 hour', 'pending')$$,
  '23503',
  NULL,
  'Cross-owner task reference on reminder is rejected'
);

-- 2. Valid absolute reminder insert succeeds
select lives_ok(
  $$insert into public.reminders (id, user_id, task_id, remind_at, status, reminder_kind) values ('77777777-7777-7777-7777-777777777771', 'a0000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666661', now() + interval '1 hour', 'pending', 'absolute')$$,
  'Valid absolute reminder inserts successfully'
);

-- 3. Duplicate active original time rejected by partial unique index
select throws_ok(
  $$insert into public.reminders (user_id, task_id, remind_at, status, reminder_kind) values ('a0000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666661', (select remind_at from public.reminders where id = '77777777-7777-7777-7777-777777777771'), 'pending', 'absolute')$$,
  '23505',
  NULL,
  'Duplicate active original time rejected by partial unique index'
);

-- 4. Two snoozed reminders can share effective_at (effective-time snooze collision allowed)
insert into public.reminders (id, user_id, task_id, remind_at, status, reminder_kind, snoozed_until)
values
  ('77777777-7777-7777-7777-777777777772', 'a0000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666661', now() + interval '40 minutes', 'snoozed', 'absolute', now() + interval '50 minutes'),
  ('77777777-7777-7777-7777-777777777773', 'a0000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666661', now() + interval '45 minutes', 'snoozed', 'absolute', now() + interval '50 minutes')
on conflict (id) do nothing;

select is(
  (select count(*)::int from public.reminders where id in ('77777777-7777-7777-7777-777777777772', '77777777-7777-7777-7777-777777777773') and status = 'snoozed'),
  2,
  'Two independently snoozed reminders can share effective_at'
);

-- 5. Relative reminder requires timed due_date on task
insert into public.tasks (id, user_id, title, status, due_at, due_date_kind)
values ('66666666-6666-6666-6666-666666666662', 'a0000000-0000-0000-0000-000000000001', 'Date-only task', 'todo', now() + interval '1 day', 'date_only')
on conflict (id) do nothing;

select throws_ok(
  $$insert into public.reminders (user_id, task_id, remind_at, status, reminder_kind, offset_minutes) values ('a0000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666662', now() + interval '1 hour', 'pending', 'relative_due', 30)$$,
  '23514',
  NULL,
  'Relative reminder on task with date_only is rejected'
);

-- 6. Relative reminder auto-derives remind_at = due_at - offset_minutes
insert into public.reminders (id, user_id, task_id, remind_at, status, reminder_kind, offset_minutes)
values ('77777777-7777-7777-7777-777777777774', 'a0000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666661', now() + interval '10 hours', 'pending', 'relative_due', 30)
on conflict (id) do nothing;

select is(
  (select remind_at from public.reminders where id = '77777777-7777-7777-7777-777777777774'),
  (select due_at - interval '30 minutes' from public.tasks where id = '66666666-6666-6666-6666-666666666661'),
  'Relative reminder derives remind_at as due_at - 30 minutes'
);

-- 7. Updating task due_at recalculates active relative reminder
update public.tasks set due_at = now() + interval '5 hours' where id = '66666666-6666-6666-6666-666666666661';

select is(
  (select remind_at from public.reminders where id = '77777777-7777-7777-7777-777777777774'),
  (select due_at - interval '30 minutes' from public.tasks where id = '66666666-6666-6666-6666-666666666661'),
  'Updating task due_at recalculates active relative reminder remind_at'
);

-- 8. Absolute reminder remind_at never moves when task due_at changes
select is(
  (select status from public.reminders where id = '77777777-7777-7777-7777-777777777771'),
  'pending',
  'Absolute reminder remains pending and unchanged after task due_at change'
);

-- 9. Clearing task due_at dismisses active relative reminder
update public.tasks set due_at = null, due_date_kind = 'date_only' where id = '66666666-6666-6666-6666-666666666661';

select is(
  (select status from public.reminders where id = '77777777-7777-7777-7777-777777777774'),
  'dismissed',
  'Clearing task due_at dismisses active relative reminder'
);

-- 10. Completing task dismisses pending/snoozed reminders
update public.tasks set status = 'done' where id = '66666666-6666-6666-6666-666666666661';

select is(
  (select count(*)::int from public.reminders where task_id = '66666666-6666-6666-6666-666666666661' and status in ('pending', 'snoozed')),
  0,
  'Completing task dismisses all active reminders'
);

-- 11. Reopening task does NOT revive dismissed reminders
update public.tasks set status = 'todo' where id = '66666666-6666-6666-6666-666666666661';

select is(
  (select count(*)::int from public.reminders where task_id = '66666666-6666-6666-6666-666666666661' and status = 'pending'),
  0,
  'Reopening task does not revive dismissed reminders'
);

-- 12. Deleting task cascades and deletes reminders
delete from public.tasks where id = '66666666-6666-6666-6666-666666666661';

select is_empty(
  'select * from public.reminders where task_id = ''66666666-6666-6666-6666-666666666661''',
  'Deleting task cascades and deletes all linked reminders'
);

-- Setup a reminder for RLS tests
insert into public.tasks (id, user_id, title, status)
values ('66666666-6666-6666-6666-666666666663', 'a0000000-0000-0000-0000-000000000001', 'Task for Reminder RLS', 'todo')
on conflict (id) do nothing;

insert into public.reminders (id, user_id, task_id, remind_at, status, reminder_kind)
values ('77777777-7777-7777-7777-777777777775', 'a0000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666663', now() + interval '2 hours', 'pending', 'absolute')
on conflict (id) do nothing;

-- 13. RLS: User A can select own reminders
set local role authenticated;
set local "request.jwt.claim.sub" to 'a0000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.reminders where id = '77777777-7777-7777-7777-777777777775'),
  1,
  'User A can select their own reminder'
);

-- 14. RLS: User B cannot select User A reminder
set local "request.jwt.claim.sub" to 'b0000000-0000-0000-0000-000000000002';

select is_empty(
  'select * from public.reminders where id = ''77777777-7777-7777-7777-777777777775''',
  'User B cannot select User A reminder'
);

-- 15. RLS: User B cannot update User A reminder
update public.reminders set status = 'dismissed' where id = '77777777-7777-7777-7777-777777777775';
set local role postgres;
select is(
  (select status from public.reminders where id = '77777777-7777-7777-7777-777777777775'),
  'pending',
  'User B cannot update User A reminder'
);

-- 16. RLS: User B cannot delete User A reminder
set local role authenticated;
set local "request.jwt.claim.sub" to 'b0000000-0000-0000-0000-000000000002';
delete from public.reminders where id = '77777777-7777-7777-7777-777777777775';
set local role postgres;
select ok(
  exists(select 1 from public.reminders where id = '77777777-7777-7777-7777-777777777775'),
  'User B cannot delete User A reminder'
);

-- 17. RLS: Admin cannot select User A reminder
set local role authenticated;
set local "request.jwt.claim.sub" to 'c0000000-0000-0000-0000-000000000003';
select is_empty(
  'select * from public.reminders where id = ''77777777-7777-7777-7777-777777777775''',
  'Admin cannot select User A reminder'
);

-- 18. Phase 2 Account policies & update_my_profile with locale
-- User A updates locale to en
set local role authenticated;
set local "request.jwt.claim.sub" to 'a0000000-0000-0000-0000-000000000001';
select public.update_my_profile(null, null, 'en');
select is(
  (select locale from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'),
  'en',
  'User A can update profile locale to en'
);

-- User A invalid locale throws error
select throws_ok(
  $$select public.update_my_profile(null, null, 'invalid_locale')$$,
  'Invalid locale: must be vi or en',
  'Updating profile with invalid locale throws error'
);

-- Setup Inactive User D, Forced User E, and Multi-task User F
set local role postgres;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('d0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'userd@tabdo.local', crypt('Password123!', gen_salt('bf')), now(), now(), now()),
  ('e0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'usere@tabdo.local', crypt('Password123!', gen_salt('bf')), now(), now(), now()),
  ('f0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'userf@tabdo.local', crypt('Password123!', gen_salt('bf')), now(), now(), now())
on conflict do nothing;

update public.profiles set is_active = false where id = 'd0000000-0000-0000-0000-000000000004';
update public.profiles set must_change_password = true where id = 'e0000000-0000-0000-0000-000000000005';

-- User D (inactive) cannot call update_my_profile
set local role authenticated;
set local "request.jwt.claim.sub" to 'd0000000-0000-0000-0000-000000000004';
select throws_ok(
  $$select public.update_my_profile('New Name', null, null)$$,
  'Account is inactive',
  'Inactive user cannot call update_my_profile'
);

-- User E (forced) cannot call update_my_profile
set local "request.jwt.claim.sub" to 'e0000000-0000-0000-0000-000000000005';
select throws_ok(
  $$select public.update_my_profile('New Name', null, null)$$,
  'Password change required',
  'Forced password change user cannot call update_my_profile'
);

-- User D (inactive) can read own profile
set local "request.jwt.claim.sub" to 'd0000000-0000-0000-0000-000000000004';
select is(
  (select is_active from public.profiles where id = 'd0000000-0000-0000-0000-000000000004'),
  false,
  'Inactive user can select own profile to view account state'
);

-- User E (forced) can read own profile
set local "request.jwt.claim.sub" to 'e0000000-0000-0000-0000-000000000005';
select is(
  (select must_change_password from public.profiles where id = 'e0000000-0000-0000-0000-000000000005'),
  true,
  'Forced user can select own profile to view password change flag'
);

-- Populate task for User D as postgres
set local role postgres;
insert into public.tasks (id, user_id, title, status)
values ('66666666-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Inactive Task', 'todo')
on conflict (id) do nothing;

-- User D (inactive) cannot select own tasks
set local role authenticated;
set local "request.jwt.claim.sub" to 'd0000000-0000-0000-0000-000000000004';
select is_empty(
  'select * from public.tasks where id = ''66666666-0000-0000-0000-000000000001''',
  'Inactive user cannot select tasks due to RLS'
);

-- User D (inactive) cannot insert task
select throws_matching(
  $$insert into public.tasks (user_id, title) values ('d0000000-0000-0000-0000-000000000004', 'New Task')$$,
  'row-level security',
  'Inactive user cannot insert tasks due to RLS'
);

-- User E (forced) cannot select or insert tasks
set local "request.jwt.claim.sub" to 'e0000000-0000-0000-0000-000000000005';
select throws_matching(
  $$insert into public.tasks (user_id, title) values ('e0000000-0000-0000-0000-000000000005', 'Forced User Task')$$,
  'row-level security',
  'Forced user cannot insert tasks due to RLS'
);

-- Setup User F with 1 parent task and 2 subtasks (total 3 tasks)
set local role postgres;
insert into public.tasks (id, user_id, title, status)
values ('66666666-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000006', 'Parent Task', 'todo')
on conflict (id) do nothing;

insert into public.tasks (id, user_id, parent_id, title, status)
values
  ('66666666-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000006', '66666666-0000-0000-0000-000000000010', 'Subtask 1', 'in_progress'),
  ('66666666-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000006', '66666666-0000-0000-0000-000000000010', 'Subtask 2', 'done')
on conflict (id) do nothing;

-- 19. Private aggregate function tests
-- Authenticated caller cannot execute get_user_task_counts
set local role authenticated;
set local "request.jwt.claim.sub" to 'c0000000-0000-0000-0000-000000000003';
select throws_matching(
  $$select * from public.get_user_task_counts()$$,
  'permission denied',
  'Authenticated caller cannot execute get_user_task_counts'
);

-- Anon caller cannot execute get_user_task_counts
set local role anon;
select throws_matching(
  $$select * from public.get_user_task_counts()$$,
  'permission denied',
  'Anon caller cannot execute get_user_task_counts'
);

-- Service role can execute and accurately aggregates subtasks
set local role service_role;
select is(
  (select task_count::int from public.get_user_task_counts(array['f0000000-0000-0000-0000-000000000006'::uuid])),
  3,
  'get_user_task_counts counts all tasks including subtasks for service_role'
);

select is(
  (select todo_count::int from public.get_user_task_counts(array['f0000000-0000-0000-0000-000000000006'::uuid])),
  1,
  'get_user_task_counts returns correct todo_count'
);

select is(
  (select in_progress_count::int from public.get_user_task_counts(array['f0000000-0000-0000-0000-000000000006'::uuid])),
  1,
  'get_user_task_counts returns correct in_progress_count'
);

select is(
  (select done_count::int from public.get_user_task_counts(array['f0000000-0000-0000-0000-000000000006'::uuid])),
  1,
  'get_user_task_counts returns correct done_count'
);

-- 17. Recurrence Lifecycle & Security Tests (18 tests)
-- Test anon execution denial
set local role anon;
select throws_matching(
  $$select public.complete_task_and_generate_next('11111111-1111-1111-1111-111111111111'::uuid, now())$$,
  'permission denied',
  'Anon caller cannot execute complete_task_and_generate_next RPC'
);

-- Reset to postgres to seed recurrence test data
set local role postgres;
insert into public.tasks (
  id, user_id, title, status, priority, due_date_kind, due_at,
  recurrence_rule, recurrence_series_id, recurrence_timezone, recurrence_anchor_at,
  description, updated_at
) values (
  'a1111111-1111-1111-1111-111111111111',
  'a0000000-0000-0000-0000-000000000001',
  'User A Daily Task',
  'todo',
  'high',
  'date_time',
  '2026-10-15 02:00:00+00',
  'FREQ=DAILY',
  '11111111-2222-3333-4444-555555555555',
  'Asia/Ho_Chi_Minh',
  '2026-10-15 02:00:00+00',
  'Task with <!-- tabdo_checklist: [{"id":"c1","text":"Step 1","completed":true}] --> and - [x] Done item',
  '2026-10-10 00:00:00+00'
) on conflict do nothing;

-- Add relative reminder for date_time task
insert into public.reminders (
  id, user_id, task_id, reminder_kind, offset_minutes, remind_at, status
) values (
  'e1111111-1111-1111-1111-111111111111',
  'a0000000-0000-0000-0000-000000000001',
  'a1111111-1111-1111-1111-111111111111',
  'relative_due',
  60,
  '2026-10-15 01:00:00+00',
  'pending'
) on conflict do nothing;

-- User B context: cannot complete User A's task
set local role authenticated;
set local "request.jwt.claim.sub" to 'b0000000-0000-0000-0000-000000000002';
select throws_matching(
  $$select public.complete_task_and_generate_next('a1111111-1111-1111-1111-111111111111'::uuid, '2026-10-10 00:00:00+00'::timestamptz)$$,
  'Task not found or access denied',
  'User B cannot complete User A task via RPC'
);

-- User A context: optimistic concurrency checks
set local "request.jwt.claim.sub" to 'a0000000-0000-0000-0000-000000000001';
select throws_matching(
  $$select public.complete_task_and_generate_next('a1111111-1111-1111-1111-111111111111'::uuid, null)$$,
  'expected_updated_at is required',
  'RPC rejects null expected_updated_at for pending task'
);

select throws_matching(
  $$select public.complete_task_and_generate_next('a1111111-1111-1111-1111-111111111111'::uuid, '2020-01-01 00:00:00+00'::timestamptz)$$,
  'Task was modified concurrently',
  'RPC rejects stale expected_updated_at'
);

-- User A completes non-recurring task
set local role postgres;
insert into public.tasks (
  id, user_id, title, status, priority, due_date_kind, updated_at
) values (
  'a2222222-2222-2222-2222-222222222222',
  'a0000000-0000-0000-0000-000000000001',
  'User A One-off Task',
  'todo',
  'low',
  'date_time',
  '2026-10-10 00:00:00+00'
) on conflict do nothing;

set local role authenticated;
set local "request.jwt.claim.sub" to 'a0000000-0000-0000-0000-000000000001';
select is(
  (public.complete_task_and_generate_next('a2222222-2222-2222-2222-222222222222'::uuid, '2026-10-10 00:00:00+00'::timestamptz)->>'generated')::boolean,
  false,
  'Non-recurring task completion returns generated: false and nextTask: null'
);

-- Recurrence rule constraint check
set local role postgres;
select throws_matching(
  $$insert into public.tasks (id, user_id, title, recurrence_rule, due_at, recurrence_series_id, recurrence_timezone, recurrence_anchor_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'Bad rule', 'FREQ=YEARLY', now(), gen_random_uuid(), 'Asia/Ho_Chi_Minh', now())$$,
  'violates check constraint',
  'Unsupported recurrence rule is rejected by constraint'
);

-- Recurrence invariants check
select throws_matching(
  $$insert into public.tasks (id, user_id, title, recurrence_rule, due_at, recurrence_series_id, recurrence_timezone, recurrence_anchor_at)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'Missing due_at', 'FREQ=DAILY', null, gen_random_uuid(), 'Asia/Ho_Chi_Minh', now())$$,
  'violates check constraint',
  'Recurring task without due_at is rejected by recurrence invariants constraint'
);

-- Cross-owner recurrence_parent_id check
select throws_matching(
  $$insert into public.tasks (id, user_id, title, recurrence_parent_id)
    values (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002', 'Cross owner parent', 'a1111111-1111-1111-1111-111111111111')$$,
  'Recurrence parent task does not belong to the same user',
  'Ownership trigger blocks linking recurrence_parent_id to another user task'
);

-- Complete recurring task a1111111
set local role authenticated;
set local "request.jwt.claim.sub" to 'a0000000-0000-0000-0000-000000000001';
select ok(
  ((public.complete_task_and_generate_next('a1111111-1111-1111-1111-111111111111'::uuid, '2026-10-10 00:00:00+00'::timestamptz)->>'generated')::boolean),
  'Recurring task completion returns generated: true'
);

-- Check status of original task
select is(
  (select status from public.tasks where id = 'a1111111-1111-1111-1111-111111111111'),
  'done',
  'Original task is marked done'
);

-- Check successor task created
select is(
  (select count(*)::int from public.tasks where recurrence_parent_id = 'a1111111-1111-1111-1111-111111111111'),
  1,
  'Successor task is created with recurrence_parent_id pointing to original task'
);

-- Check successor task status is todo
select is(
  (select status from public.tasks where recurrence_parent_id = 'a1111111-1111-1111-1111-111111111111'),
  'todo',
  'Successor task status is todo'
);

-- Check checklist reset in successor description
select is(
  (select description from public.tasks where recurrence_parent_id = 'a1111111-1111-1111-1111-111111111111'),
  'Task with <!-- tabdo_checklist: [{"id":"c1","text":"Step 1","completed":false}] --> and - [ ] Done item',
  'Successor task description has checklist completed flags reset to false'
);

-- Check successor reminder copied
select is(
  (select count(*)::int from public.reminders where task_id = (select id from public.tasks where recurrence_parent_id = 'a1111111-1111-1111-1111-111111111111') and reminder_kind = 'relative_due' and offset_minutes = 60),
  1,
  'Relative reminder was copied to successor task'
);

-- Check original task reminders dismissed
select is(
  (select status from public.reminders where task_id = 'a1111111-1111-1111-1111-111111111111'),
  'dismissed',
  'Original task reminder was dismissed'
);

-- Test idempotency: calling complete_task_and_generate_next on already done task
select is(
  (public.complete_task_and_generate_next('a1111111-1111-1111-1111-111111111111'::uuid, '2026-10-10 00:00:00+00'::timestamptz)->>'reusedExistingSuccessor')::boolean,
  true,
  'Retrying completion on already-done task returns reusedExistingSuccessor: true'
);

-- Direct attempt to create a second successor for same recurrence_parent_id fails unique index
set local role postgres;
select throws_matching(
  $$insert into public.tasks (id, user_id, title, due_at, recurrence_rule, recurrence_series_id, recurrence_timezone, recurrence_anchor_at, recurrence_parent_id)
    values (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'Duplicate successor', now(), 'FREQ=DAILY', '11111111-2222-3333-4444-555555555555', 'Asia/Ho_Chi_Minh', now(), 'a1111111-1111-1111-1111-111111111111')$$,
  'violates unique constraint',
  'Partial unique index prevents inserting a second successor for same recurrence_parent_id'
);

-- Date-only recurring task does not copy relative reminders
insert into public.tasks (
  id, user_id, title, status, priority, due_date_kind, due_at,
  recurrence_rule, recurrence_series_id, recurrence_timezone, recurrence_anchor_at, updated_at
) values (
  'a3333333-3333-3333-3333-333333333333',
  'a0000000-0000-0000-0000-000000000001',
  'User A Date-Only Recurring',
  'todo',
  'low',
  'date_only',
  '2026-10-15 16:59:59.999+00',
  'FREQ=DAILY',
  '33333333-2222-3333-4444-555555555555',
  'Asia/Ho_Chi_Minh',
  '2026-10-15 16:59:59.999+00',
  '2026-10-10 00:00:00+00'
) on conflict do nothing;

set local role authenticated;
set local "request.jwt.claim.sub" to 'a0000000-0000-0000-0000-000000000001';
select ok(
  ((public.complete_task_and_generate_next('a3333333-3333-3333-3333-333333333333'::uuid, '2026-10-10 00:00:00+00'::timestamptz)->>'generated')::boolean),
  'Date-only recurring task completes and generates successor'
);

select is(
  (select count(*)::int from public.reminders where task_id = (select id from public.tasks where recurrence_parent_id = 'a3333333-3333-3333-3333-333333333333')),
  0,
  'No relative reminders copied for date_only successor task'
);

select * from finish();
rollback;

