-- Supabase Local Demo Fixture
-- Populates Admin and Regular User accounts, realistic tasks, schedules, categories, reminders.
-- DO NOT RUN OR DEPLOY TO PRODUCTION / REMOTE SUPABASE. Local-only fixture.

BEGIN;

-- 1. Create Demo Users in auth.users and auth.identities
-- Stable UUIDs:
-- Admin: 11111111-1111-4111-8111-111111111111
-- User:  22222222-2222-4222-8222-222222222222

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  created_at,
  updated_at
)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin.demo@tabdo.local',
    crypt(gen_random_uuid()::text, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"displayName":"Admin Demo","name":"Admin Demo","timezone":"Asia/Ho_Chi_Minh","locale":"vi"}',
    '',
    '',
    '',
    '',
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user.demo@tabdo.local',
    crypt(gen_random_uuid()::text, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"displayName":"User Demo","name":"User Demo","timezone":"Asia/Ho_Chi_Minh","locale":"vi"}',
    '',
    '',
    '',
    '',
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'admin.demo@tabdo.local',
    '11111111-1111-4111-8111-111111111111',
    jsonb_build_object('sub', '11111111-1111-4111-8111-111111111111', 'email', 'admin.demo@tabdo.local'),
    'email',
    now(),
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'user.demo@tabdo.local',
    '22222222-2222-4222-8222-222222222222',
    jsonb_build_object('sub', '22222222-2222-4222-8222-222222222222', 'email', 'user.demo@tabdo.local'),
    'email',
    now(),
    now(),
    now()
  )
ON CONFLICT (provider, provider_id) DO NOTHING;

-- 2. Configure Profiles
UPDATE public.profiles
SET
  role = 'admin',
  is_active = true,
  must_change_password = false,
  timezone = 'Asia/Ho_Chi_Minh',
  locale = 'vi'
WHERE id = '11111111-1111-4111-8111-111111111111';

UPDATE public.profiles
SET
  role = 'user',
  is_active = true,
  must_change_password = false,
  timezone = 'Asia/Ho_Chi_Minh',
  locale = 'vi'
WHERE id = '22222222-2222-4222-8222-222222222222';

-- 3. Categories
INSERT INTO public.categories (id, user_id, name, color, icon, created_at, updated_at)
VALUES
  ('33333333-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Công việc', '#3b82f6', 'briefcase', now(), now()),
  ('33333333-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Học tập', '#10b981', 'book-open', now(), now()),
  ('33333333-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Dự án TabDo', '#8b5cf6', 'layout', now(), now()),
  ('33333333-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Cá nhân', '#f59e0b', 'user', now(), now()),
  ('33333333-0000-4000-8000-000000000011', '22222222-2222-4222-8222-222222222222', 'Việc hàng ngày', '#06b6d4', 'check-circle', now(), now()),
  ('33333333-0000-4000-8000-000000000012', '22222222-2222-4222-8222-222222222222', 'Sức khỏe', '#ec4899', 'heart', now(), now())
ON CONFLICT (id) DO NOTHING;

-- 4. Tasks for Admin (111 tasks total: 50 Todo, 25 In Progress, 30 Done, 1 Recurring Successor, 5 Trashed)
DO $$
DECLARE
  v_admin_id uuid := '11111111-1111-4111-8111-111111111111';
  v_cat_work uuid := '33333333-0000-4000-8000-000000000001';
  v_cat_study uuid := '33333333-0000-4000-8000-000000000002';
  v_cat_tabdo uuid := '33333333-0000-4000-8000-000000000003';
  v_cat_personal uuid := '33333333-0000-4000-8000-000000000004';
  v_user_cat1 uuid := '33333333-0000-4000-8000-000000000011';
  v_user_cat2 uuid := '33333333-0000-4000-8000-000000000012';
  v_series_id uuid := '55555555-5555-4555-8555-555555555551';
  v_today_start timestamptz := date_trunc('day', timezone('Asia/Ho_Chi_Minh', now())) AT TIME ZONE 'Asia/Ho_Chi_Minh';
  i int;
  v_task_id uuid;
  v_cat uuid;
  v_priority text;
  v_due timestamptz;
  v_due_kind text;
BEGIN
  -- 4.1. Admin TODO tasks (50 tasks: 1 to 50)
  FOR i IN 1..50 LOOP
    v_task_id := ('44444444-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;

    -- Pick category cyclically
    CASE (i % 5)
      WHEN 0 THEN v_cat := v_cat_work;
      WHEN 1 THEN v_cat := v_cat_tabdo;
      WHEN 2 THEN v_cat := v_cat_study;
      WHEN 3 THEN v_cat := v_cat_personal;
      ELSE v_cat := NULL;
    END CASE;

    -- Pick priority
    CASE (i % 3)
      WHEN 0 THEN v_priority := 'high';
      WHEN 1 THEN v_priority := 'medium';
      ELSE v_priority := 'low';
    END CASE;

    -- Pick due date distribution
    IF i <= 10 THEN
      -- Overdue: past 1 to 5 days
      v_due := v_today_start - ((i % 5 + 1) || ' days')::interval + '17:00'::interval;
      v_due_kind := 'date_time';
    ELSIF i <= 20 THEN
      -- Due today
      v_due := v_today_start + '18:00'::interval;
      v_due_kind := 'date_only';
    ELSIF i <= 30 THEN
      -- Due tomorrow
      v_due := v_today_start + interval '1 day' + '15:00'::interval;
      v_due_kind := 'date_time';
    ELSIF i <= 40 THEN
      -- Next week
      v_due := v_today_start + ((i - 30 + 2) || ' days')::interval;
      v_due_kind := 'date_only';
    ELSE
      -- No due date
      v_due := NULL;
      v_due_kind := 'date_only';
    END IF;

    INSERT INTO public.tasks (
      id, user_id, category_id, title, description, status, priority,
      due_at, due_date_kind, created_at, updated_at
    ) VALUES (
      v_task_id,
      v_admin_id,
      v_cat,
      'Công việc cần làm #' || i || ': ' || CASE (i % 10)
        WHEN 0 THEN 'Kiểm thử khả năng chịu tải Kanban Board'
        WHEN 1 THEN 'Tối ưu hóa truy vấn Supabase RLS'
        WHEN 2 THEN 'Cập nhật tài liệu hướng dẫn REST API'
        WHEN 3 THEN 'Rà soát bảo mật phân quyền tài khoản Admin'
        WHEN 4 THEN 'Lập lịch đồng bộ nhắc nhở trình duyệt'
        WHEN 5 THEN 'Thiết kế giao diện thẻ công việc Responsive'
        WHEN 6 THEN 'Chuẩn bị kịch bản kiểm thử tự động UAT'
        WHEN 7 THEN 'Họp rà soát kiến trúc định kỳ tuần'
        WHEN 8 THEN 'Nghiên cứu tính năng kéo thả trên màn hình cảm ứng'
        ELSE 'Cấu hình cảnh báo hiệu năng ứng dụng'
      END,
      'Chi tiết nhiệm vụ backlog #' || i || ' phục vụ quy trình kiểm thử tải và phân trang giao diện Kanban.',
      'todo',
      v_priority,
      v_due,
      v_due_kind,
      now() - (i || ' hours')::interval,
      now() - (i || ' hours')::interval
    );
  END LOOP;

  -- 4.2. Admin IN_PROGRESS tasks (25 tasks: 51 to 75)
  FOR i IN 51..75 LOOP
    v_task_id := ('44444444-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;

    CASE (i % 4)
      WHEN 0 THEN v_cat := v_cat_tabdo;
      WHEN 1 THEN v_cat := v_cat_work;
      WHEN 2 THEN v_cat := v_cat_study;
      ELSE v_cat := NULL;
    END CASE;

    CASE (i % 3)
      WHEN 0 THEN v_priority := 'high';
      WHEN 1 THEN v_priority := 'medium';
      ELSE v_priority := 'low';
    END CASE;

    IF i <= 60 THEN
      v_due := v_today_start + '17:30'::interval;
      v_due_kind := 'date_time';
    ELSIF i <= 70 THEN
      v_due := v_today_start + interval '2 days';
      v_due_kind := 'date_only';
    ELSE
      v_due := NULL;
      v_due_kind := 'date_only';
    END IF;

    INSERT INTO public.tasks (
      id, user_id, category_id, title, description, status, priority,
      due_at, due_date_kind, created_at, updated_at
    ) VALUES (
      v_task_id,
      v_admin_id,
      v_cat,
      'Đang thực hiện #' || i || ': ' || CASE (i % 6)
        WHEN 0 THEN 'Triển khai widget Công việc đang làm trên Dashboard'
        WHEN 1 THEN 'Hoàn thiện tương tác Drag and Drop trên Kanban'
        WHEN 2 THEN 'Xử lý logic đóng mở Drawer chi tiết công việc'
        WHEN 3 THEN 'Tích hợp xác thực hai yếu tố cho Admin'
        WHEN 4 THEN 'Tối ưu CSS Grid cho hiển thị đa kích thước màn hình'
        ELSE 'Xây dựng kịch bản seed dữ liệu mẫu cục bộ'
      END,
      'Nhiệm vụ đang tiến hành được theo dõi liên tục trong sprint hiện tại.',
      'in_progress',
      v_priority,
      v_due,
      v_due_kind,
      now() - (i || ' hours')::interval,
      now() - ((i - 50) || ' minutes')::interval
    );
  END LOOP;

  -- 4.3. Admin DONE tasks (30 tasks: 76 to 105)
  FOR i IN 76..105 LOOP
    v_task_id := ('44444444-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;

    CASE (i % 4)
      WHEN 0 THEN v_cat := v_cat_work;
      WHEN 1 THEN v_cat := v_cat_tabdo;
      WHEN 2 THEN v_cat := v_cat_personal;
      ELSE v_cat := NULL;
    END CASE;

    CASE (i % 3)
      WHEN 0 THEN v_priority := 'high';
      WHEN 1 THEN v_priority := 'medium';
      ELSE v_priority := 'low';
    END CASE;

    IF i = 76 THEN
      -- Recurring parent task (completed yesterday)
      INSERT INTO public.tasks (
        id, user_id, category_id, title, description, status, priority,
        due_at, due_date_kind, completed_at, recurrence_rule, recurrence_series_id,
        recurrence_timezone, recurrence_anchor_at, created_at, updated_at
      ) VALUES (
        v_task_id,
        v_admin_id,
        v_cat_work,
        'Họp Sync hàng ngày với đội phát triển (Chu kỳ cũ)',
        'Công việc định kỳ hàng ngày đã hoàn tất chu kỳ trước.',
        'done',
        'high',
        v_today_start - interval '1 day' + '09:00'::interval,
        'date_time',
        v_today_start - interval '1 day' + '09:30'::interval,
        'FREQ=DAILY',
        v_series_id,
        'Asia/Ho_Chi_Minh',
        v_today_start - interval '1 day' + '09:00'::interval,
        now() - interval '2 days',
        v_today_start - interval '1 day' + '09:30'::interval
      );
    ELSE
      -- Normal completed tasks
      v_due := v_today_start - ((i - 76) || ' days')::interval + '16:00'::interval;
      INSERT INTO public.tasks (
        id, user_id, category_id, title, description, status, priority,
        due_at, due_date_kind, completed_at, created_at, updated_at
      ) VALUES (
        v_task_id,
        v_admin_id,
        v_cat,
        'Đã hoàn thành #' || i || ': ' || CASE (i % 5)
          WHEN 0 THEN 'Cài đặt môi trường Supabase CLI'
          WHEN 1 THEN 'Thiết lập schema database ban đầu'
          WHEN 2 THEN 'Cấu hình CI/CD GitHub Actions'
          WHEN 3 THEN 'Kiểm tra độ bảo mật mã hóa mật khẩu'
          ELSE 'Cập nhật README hướng dẫn vận hành'
        END,
        'Nhiệm vụ đã hoàn tất và nghiệm thu thành công.',
        'done',
        v_priority,
        v_due,
        'date_time',
        v_due + interval '30 minutes',
        now() - (i || ' hours')::interval,
        now() - ((i - 70) || ' hours')::interval
      );
    END IF;
  END LOOP;

  -- 4.4. Recurring successor task (Todo) spawned from Task 76
  INSERT INTO public.tasks (
    id, user_id, category_id, title, description, status, priority,
    due_at, due_date_kind, recurrence_rule, recurrence_series_id,
    recurrence_parent_id, recurrence_timezone, recurrence_anchor_at,
    created_at, updated_at
  ) VALUES (
    '44444444-0000-4000-8000-000000000106',
    v_admin_id,
    v_cat_work,
    'Họp Sync hàng ngày với đội phát triển (Chu kỳ hôm nay)',
    'Nhiệm vụ kế thừa tự động từ phiên làm việc hôm qua.',
    'todo',
    'high',
    v_today_start + '09:00'::interval,
    'date_time',
    'FREQ=DAILY',
    v_series_id,
    '44444444-0000-4000-8000-000000000076',
    'Asia/Ho_Chi_Minh',
    v_today_start + '09:00'::interval,
    now() - interval '1 day',
    now() - interval '1 day'
  );

  -- 4.5. Admin Trashed tasks (5 tasks: 107 to 111)
  FOR i IN 107..111 LOOP
    v_task_id := ('44444444-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
    INSERT INTO public.tasks (
      id, user_id, category_id, title, description, status, priority,
      due_at, due_date_kind, deleted_at, deletion_batch_id, created_at, updated_at
    ) VALUES (
      v_task_id,
      v_admin_id,
      v_cat_work,
      'Task đã xóa trong thùng rác #' || i,
      'Nhiệm vụ đã chuyển vào thùng rác để kiểm tra lifecycle.',
      'todo',
      'low',
      v_today_start + interval '3 days',
      'date_only',
      now() - (i || ' minutes')::interval,
      gen_random_uuid(),
      now() - interval '5 days',
      now() - (i || ' minutes')::interval
    );
  END LOOP;

  -- 5. Tasks for Regular User (22 tasks: 10 Todo, 6 In Progress, 6 Done)
  FOR i IN 1..22 LOOP
    v_task_id := ('44444444-0000-4000-8000-' || lpad((200 + i)::text, 12, '0'))::uuid;

    IF i <= 10 THEN
      -- Todo
      INSERT INTO public.tasks (
        id, user_id, category_id, title, description, status, priority,
        due_at, due_date_kind, created_at, updated_at
      ) VALUES (
        v_task_id,
        '22222222-2222-4222-8222-222222222222'::uuid,
        CASE WHEN i % 2 = 0 THEN v_user_cat1 ELSE v_user_cat2 END,
        'Việc cần làm của User #' || i || ': ' || CASE (i % 4)
          WHEN 0 THEN 'Đọc tài liệu quy trình làm việc'
          WHEN 1 THEN 'Ghi chép kế hoạch học tập tuần'
          WHEN 2 THEN 'Tập thể dục buổi chiều'
          ELSE 'Cập nhật danh sách công việc cá nhân'
        END,
        'Mô tả nhiệm vụ cá nhân của tài khoản User Demo.',
        'todo',
        CASE WHEN i % 3 = 0 THEN 'high' WHEN i % 3 = 1 THEN 'medium' ELSE 'low' END,
        v_today_start + ((i % 5) || ' days')::interval,
        'date_only',
        now() - (i || ' hours')::interval,
        now() - (i || ' hours')::interval
      );
    ELSIF i <= 16 THEN
      -- In progress
      INSERT INTO public.tasks (
        id, user_id, category_id, title, description, status, priority,
        due_at, due_date_kind, created_at, updated_at
      ) VALUES (
        v_task_id,
        '22222222-2222-4222-8222-222222222222'::uuid,
        v_user_cat1,
        'Đang thực hiện của User #' || i || ': Viết bài tổng hợp kiến thức',
        'Mô tả chi tiết nhiệm vụ đang tiến hành của User.',
        'in_progress',
        'medium',
        v_today_start + '17:00'::interval,
        'date_time',
        now() - (i || ' hours')::interval,
        now() - interval '10 minutes'
      );
    ELSE
      -- Done
      INSERT INTO public.tasks (
        id, user_id, category_id, title, description, status, priority,
        due_at, due_date_kind, completed_at, created_at, updated_at
      ) VALUES (
        v_task_id,
        '22222222-2222-4222-8222-222222222222'::uuid,
        v_user_cat2,
        'Đã xong của User #' || i || ': Kiểm tra sức khỏe định kỳ',
        'Nhiệm vụ đã hoàn tất tuần trước.',
        'done',
        'low',
        v_today_start - interval '2 days',
        'date_only',
        v_today_start - interval '2 days',
        now() - interval '5 days',
        now() - interval '2 days'
      );
    END IF;
  END LOOP;
END $$;

-- 6. Schedule Blocks (Admin >= 20 blocks, User >= 8 blocks)
DO $$
DECLARE
  v_admin_id uuid := '11111111-1111-4111-8111-111111111111';
  v_user_id  uuid := '22222222-2222-4222-8222-222222222222';
  v_today_start timestamptz := date_trunc('day', timezone('Asia/Ho_Chi_Minh', now())) AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_multi_task_id uuid := '44444444-0000-4000-8000-000000000051';
BEGIN
  -- Admin Schedule Blocks (24 blocks total)
  -- Yesterday: 3 blocks
  INSERT INTO public.schedule_blocks (id, user_id, task_id, title, start_at, end_at, created_at, updated_at) VALUES
    ('66666666-0000-4000-8000-000000000001', v_admin_id, '44444444-0000-4000-8000-000000000076', 'Họp Sync ngày hôm qua', v_today_start - interval '1 day' + '09:00'::interval, v_today_start - interval '1 day' + '09:45'::interval, now(), now()),
    ('66666666-0000-4000-8000-000000000002', v_admin_id, '44444444-0000-4000-8000-000000000001', 'Kiểm thử tải hệ thống', v_today_start - interval '1 day' + '10:00'::interval, v_today_start - interval '1 day' + '12:00'::interval, now(), now()),
    ('66666666-0000-4000-8000-000000000003', v_admin_id, NULL, 'Nghỉ trưa & đọc sách công nghệ', v_today_start - interval '1 day' + '12:00'::interval, v_today_start - interval '1 day' + '13:00'::interval, now(), now());

  -- Today: 5 blocks for Admin (>= 4 required)
  INSERT INTO public.schedule_blocks (id, user_id, task_id, title, start_at, end_at, created_at, updated_at) VALUES
    ('66666666-0000-4000-8000-000000000004', v_admin_id, '44444444-0000-4000-8000-000000000106', 'Họp Standup sáng đầu ngày', v_today_start + '08:30'::interval, v_today_start + '09:15'::interval, now(), now()),
    ('66666666-0000-4000-8000-000000000005', v_admin_id, v_multi_task_id, 'Phát triển widget Dashboard (Phiên sáng)', v_today_start + '09:30'::interval, v_today_start + '11:45'::interval, now(), now()),
    ('66666666-0000-4000-8000-000000000006', v_admin_id, NULL, 'Ăn trưa & thư giãn giữa ngày', v_today_start + '12:00'::interval, v_today_start + '13:15'::interval, now(), now()),
    -- Block 2 linked to the SAME task (multi-block task test)
    ('66666666-0000-4000-8000-000000000007', v_admin_id, v_multi_task_id, 'Phát triển widget Dashboard (Phiên chiều)', v_today_start + '13:30'::interval, v_today_start + '15:30'::interval, now(), now()),
    ('66666666-0000-4000-8000-000000000008', v_admin_id, '44444444-0000-4000-8000-000000000052', 'Review tương tác kéo thả Kanban', v_today_start + '16:00'::interval, v_today_start + '17:30'::interval, now(), now());

  -- Midnight crossing block in Asia/Ho_Chi_Minh (23:30 today to 01:00 tomorrow)
  INSERT INTO public.schedule_blocks (id, user_id, task_id, title, start_at, end_at, created_at, updated_at) VALUES
    ('66666666-0000-4000-8000-000000000009', v_admin_id, NULL, 'Bảo trì máy chủ định kỳ qua đêm', v_today_start + '23:30'::interval, v_today_start + interval '1 day' + '01:00'::interval, now(), now());

  -- Tomorrow and subsequent days: 15 blocks
  FOR i IN 1..15 LOOP
    INSERT INTO public.schedule_blocks (id, user_id, task_id, title, start_at, end_at, created_at, updated_at) VALUES (
      ('66666666-0000-4000-8000-' || lpad((9 + i)::text, 12, '0'))::uuid,
      v_admin_id,
      ('44444444-0000-4000-8000-' || lpad((52 + (i % 10))::text, 12, '0'))::uuid,
      'Khối lịch làm việc Admin #' || i,
      v_today_start + ((i % 6 + 1) || ' days')::interval + '09:00'::interval,
      v_today_start + ((i % 6 + 1) || ' days')::interval + '11:00'::interval,
      now(),
      now()
    );
  END LOOP;

  -- User Schedule Blocks (9 blocks total)
  -- Today: 2 blocks (>= 2 required)
  INSERT INTO public.schedule_blocks (id, user_id, task_id, title, start_at, end_at, created_at, updated_at) VALUES
    ('66666666-0000-4000-8000-000000000201', v_user_id, '44444444-0000-4000-8000-000000000211', 'Phiên làm việc User hôm nay', v_today_start + '10:00'::interval, v_today_start + '11:30'::interval, now(), now()),
    ('66666666-0000-4000-8000-000000000202', v_user_id, NULL, 'Đọc tài liệu hướng dẫn', v_today_start + '14:00'::interval, v_today_start + '15:00'::interval, now(), now());

  -- Other days: 7 blocks
  FOR i IN 3..9 LOOP
    INSERT INTO public.schedule_blocks (id, user_id, task_id, title, start_at, end_at, created_at, updated_at) VALUES (
      ('66666666-0000-4000-8000-' || lpad((200 + i)::text, 12, '0'))::uuid,
      v_user_id,
      ('44444444-0000-4000-8000-' || lpad((200 + i)::text, 12, '0'))::uuid,
      'Khối lịch User ngày tới #' || i,
      v_today_start + ((i % 5 + 1) || ' days')::interval + '13:00'::interval,
      v_today_start + ((i % 5 + 1) || ' days')::interval + '14:30'::interval,
      now(),
      now()
    );
  END LOOP;
END $$;

-- 7. Reminders (Absolute and Relative for valid tasks)
INSERT INTO public.reminders (
  id, user_id, task_id, remind_at, status, reminder_kind, offset_minutes, created_at, updated_at
)
VALUES
  -- Admin Absolute Reminder pending
  (
    '77777777-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    '44444444-0000-4000-8000-000000000051',
    now() + interval '2 hours',
    'pending',
    'absolute',
    NULL,
    now(),
    now()
  ),
  -- Admin Relative Reminder pending (offset 15 mins before due).
  -- Use task #21 (tomorrow at 15:00 ICT), not task #52 (today at 17:30 ICT):
  -- the reminder trigger derives remind_at from task due_at and rejects past times.
  (
    '77777777-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    '44444444-0000-4000-8000-000000000021',
    now() + interval '4 hours',
    'pending',
    'relative_due',
    15,
    now(),
    now()
  ),
  -- Admin Dismissed Reminder
  (
    '77777777-0000-4000-8000-000000000003',
    '11111111-1111-4111-8111-111111111111',
    '44444444-0000-4000-8000-000000000076',
    now() - interval '1 day',
    'dismissed',
    'absolute',
    NULL,
    now() - interval '2 days',
    now() - interval '1 day'
  ),
  -- User Reminder pending
  (
    '77777777-0000-4000-8000-000000000201',
    '22222222-2222-4222-8222-222222222222',
    '44444444-0000-4000-8000-000000000211',
    now() + interval '3 hours',
    'pending',
    'absolute',
    NULL,
    now(),
    now()
  );

COMMIT;
