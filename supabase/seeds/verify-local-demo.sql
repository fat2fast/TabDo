-- Verification Script for Local Demo Seed Fixture
-- Performs assertions on user accounts, roles, task counts, schedules, timezone boundaries, and owner separation.

DO $$
DECLARE
  v_admin_id uuid := '11111111-1111-4111-8111-111111111111';
  v_user_id  uuid := '22222222-2222-4222-8222-222222222222';
  v_count int;
  v_today_start timestamptz := date_trunc('day', timezone('Asia/Ho_Chi_Minh', now())) AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_today_end   timestamptz := v_today_start + interval '1 day';
BEGIN
  -- 1. Verify Users & Profiles
  SELECT count(*) INTO v_count
  FROM public.profiles
  WHERE id = v_admin_id AND role = 'admin' AND is_active = true AND must_change_password = false AND timezone = 'Asia/Ho_Chi_Minh';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Assertion failed: Admin user profile is missing or invalid';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.profiles
  WHERE id = v_user_id AND role = 'user' AND is_active = true AND must_change_password = false AND timezone = 'Asia/Ho_Chi_Minh';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Assertion failed: Regular user profile is missing or invalid';
  END IF;

  -- 2. Verify Task Counts
  -- Admin total tasks >= 105
  SELECT count(*) INTO v_count
  FROM public.tasks
  WHERE user_id = v_admin_id;
  IF v_count < 105 THEN
    RAISE EXCEPTION 'Assertion failed: Admin task count is % (expected >= 105)', v_count;
  END IF;

  -- Admin todo tasks >= 31
  SELECT count(*) INTO v_count
  FROM public.tasks
  WHERE user_id = v_admin_id AND status = 'todo' AND deleted_at IS NULL;
  IF v_count < 31 THEN
    RAISE EXCEPTION 'Assertion failed: Admin active todo tasks count is % (expected >= 31)', v_count;
  END IF;

  -- User total tasks >= 20
  SELECT count(*) INTO v_count
  FROM public.tasks
  WHERE user_id = v_user_id;
  IF v_count < 20 THEN
    RAISE EXCEPTION 'Assertion failed: User task count is % (expected >= 20)', v_count;
  END IF;

  -- 3. Verify Schedule Blocks
  -- Admin total schedule blocks >= 20
  SELECT count(*) INTO v_count
  FROM public.schedule_blocks
  WHERE user_id = v_admin_id;
  IF v_count < 20 THEN
    RAISE EXCEPTION 'Assertion failed: Admin schedule blocks count is % (expected >= 20)', v_count;
  END IF;

  -- Admin today schedule blocks >= 4
  SELECT count(*) INTO v_count
  FROM public.schedule_blocks
  WHERE user_id = v_admin_id
    AND start_at >= v_today_start AND start_at < v_today_end;
  IF v_count < 4 THEN
    RAISE EXCEPTION 'Assertion failed: Admin today schedule blocks count is % (expected >= 4)', v_count;
  END IF;

  -- User total schedule blocks >= 8
  SELECT count(*) INTO v_count
  FROM public.schedule_blocks
  WHERE user_id = v_user_id;
  IF v_count < 8 THEN
    RAISE EXCEPTION 'Assertion failed: User schedule blocks count is % (expected >= 8)', v_count;
  END IF;

  -- User today schedule blocks >= 2
  SELECT count(*) INTO v_count
  FROM public.schedule_blocks
  WHERE user_id = v_user_id
    AND start_at >= v_today_start AND start_at < v_today_end;
  IF v_count < 2 THEN
    RAISE EXCEPTION 'Assertion failed: User today schedule blocks count is % (expected >= 2)', v_count;
  END IF;

  -- 4. Midnight crossing schedule block in Asia/Ho_Chi_Minh
  SELECT count(*) INTO v_count
  FROM public.schedule_blocks
  WHERE timezone('Asia/Ho_Chi_Minh', start_at)::date <> timezone('Asia/Ho_Chi_Minh', end_at)::date;
  IF v_count < 1 THEN
    RAISE EXCEPTION 'Assertion failed: No midnight-crossing schedule block found in Asia/Ho_Chi_Minh';
  END IF;

  -- 5. Task linked to multiple schedule blocks
  SELECT count(*) INTO v_count
  FROM (
    SELECT task_id
    FROM public.schedule_blocks
    WHERE task_id IS NOT NULL
    GROUP BY task_id
    HAVING count(*) >= 2
  ) sub;
  IF v_count < 1 THEN
    RAISE EXCEPTION 'Assertion failed: No task linked to multiple schedule blocks found';
  END IF;

  -- 6. Invariants: no schedule block points to trashed task
  SELECT count(*) INTO v_count
  FROM public.schedule_blocks sb
  JOIN public.tasks t ON sb.task_id = t.id
  WHERE t.deleted_at IS NOT NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Assertion failed: Found % schedule block(s) pointing to trashed tasks', v_count;
  END IF;

  -- 7. Invariants: no cross-owner schedule blocks
  SELECT count(*) INTO v_count
  FROM public.schedule_blocks sb
  JOIN public.tasks t ON sb.task_id = t.id
  WHERE sb.user_id <> t.user_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Assertion failed: Found % cross-owner schedule block(s)', v_count;
  END IF;

  -- 8. Reminders exist and are valid
  SELECT count(*) INTO v_count
  FROM public.reminders;
  IF v_count < 3 THEN
    RAISE EXCEPTION 'Assertion failed: Expected at least 3 reminders, found %', v_count;
  END IF;

  RAISE NOTICE 'seed fixture PASS';
END $$;
