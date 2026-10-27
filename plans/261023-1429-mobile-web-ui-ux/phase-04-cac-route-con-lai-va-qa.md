---
title: "Phase 04: Các route còn lại và QA"
status: done
priority: P2
effort: "1-2 ngày"
dependencies: [phase-03-calendar-agenda-mobile]
---

# Phase 04 — Các route còn lại và QA

## Mục tiêu

Hoàn thiện responsive presentation cho toàn bộ route còn lại, chạy test/build và đóng acceptance trên iOS Safari, Android Chrome cùng desktop.

## Checklist

- [x] Task 4.1 — Dashboard và Summary/report
- [x] Task 4.2 — Settings, login và password
- [x] Task 4.3 — Admin tối thiểu dùng được
- [x] Task 4.4 — Ma trận QA cuối và docs nhỏ nhất

## File sở hữu

Mọi đường dẫn bắt đầu bằng `pages/` hoặc `features/` trong phase này được tính từ `apps/web/src/`.

- Dashboard: `pages/DashboardPage.tsx`; presentation components `features/dashboard/components/today-overview-card.tsx`, `today-schedule.tsx`, `in-progress-tasks.tsx`, `overdue-tasks.tsx`, `priority-tasks.tsx`, `upcoming-deadlines.tsx`; tạo `features/dashboard/dashboard-mobile.css` nếu baseline chứng minh cần.
- Summary/report: `pages/SummaryPage.tsx`, `pages/MonthlyReportPage.tsx`, `features/summary/components/summary-period-controls.tsx`, `daily-summary.tsx`, `weekly-summary.tsx`, `completed-list.tsx`, `overdue-summary.tsx`, `carry-over-list.tsx`; tạo `features/summary/summary-mobile.css` nếu baseline chứng minh cần.
- Settings/auth: `pages/SettingsPage.tsx`, `LoginPage.tsx`, `AdminLoginPage.tsx`, `ChangeInitialPasswordPage.tsx`, `features/settings/AccountSettings.tsx`, `features/auth/LoginForm.tsx`, tạo CSS mobile theo feature.
- Admin: `pages/AdminDashboardPage.tsx`, `AdminUsersPage.tsx`, `features/admin/CreateUserForm.tsx`, tạo `features/admin/admin-mobile.css`.
- Không sửa API, hooks hoặc metric utilities trong phase này nếu không có test failure chứng minh presentation contract cần thay đổi.
- Chỉ cập nhật `docs/phases/phase-12-mobile-first-web-experience.md` sau khi implementation/validation thật khớp; không cập nhật changelog chỉ vì hoàn thành phase.

## Task 4.1 — Dashboard và Summary/report

- **Goal:** Các widget, controls và report vẫn đọc/thao tác được trên phone mà không mất nội dung/action.
- **Target files and symbols:** `DashboardPage.tsx:15`, `SummaryPage.tsx:13`, `MonthlyReportPage.tsx:24`, components/CSS và tests hiện hữu.
- **Steps:**
  1. Stack dashboard widgets theo task priority, giữ click mở cùng `TaskDrawer` và mọi empty/loading/error state.
  2. Điều chỉnh Summary period/date controls; responsive baseline đã có ở `styles.css:11082-11098`, nên chỉ sửa phần còn overflow/khó thao tác dựa trên rendered evidence.
  3. Monthly report giữ filters, export và dữ liệu; controls wrap/stack, không bỏ field/action.
  4. Không thay query/mutation/metrics.
- **Success criteria:** Dashboard/Summary/report hoàn thành luồng chính ở 320/390px, export/filter reachable, desktop không đổi.
- **Verify:** `pnpm --filter @tabdo/web exec vitest run src/features/dashboard/__tests__/dashboard-page.test.tsx src/pages/__tests__/summary-page.test.tsx src/pages/__tests__/monthly-report-page.test.tsx` exits 0.

## Task 4.2 — Settings, login và password

- **Goal:** Auth/settings forms dùng được với mobile keyboard, password manager, validation và error recovery hiện có.
- **Target files and symbols:** `SettingsPage.tsx:4`, `LoginPage.tsx:4`, `AdminLoginPage.tsx:4`, `ChangeInitialPasswordPage.tsx:7`, `AccountSettings.tsx`, `LoginForm.tsx`, feature CSS/tests.
- **Steps:**
  1. Giữ một Supabase session và route guard; chỉ đổi layout/presentation.
  2. Dùng one-column form, labels luôn thấy, input type/autocomplete hiện có, submit/cancel in-flow hoặc sticky chỉ khi keyboard clearance được chứng minh.
  3. Giữ server/client validation và submitted values; error liên kết/focus rõ, không thêm rule email/password mới.
  4. Kiểm tra language/account controls và forced initial-password flow.
- **Success criteria:** Login, admin login, change password, settings save/error đều reachable khi keyboard mở; zoom 200% không mất control.
- **Verify:** `pnpm --filter @tabdo/web exec vitest run src/features/auth/__tests__/auth-routing.test.tsx src/features/settings/__tests__/account-settings.test.tsx` exits 0.

## Task 4.3 — Admin tối thiểu dùng được

- **Goal:** Admin dashboard/users có thể đọc, filter, tạo và quản lý lifecycle trên phone mà giữ privacy/permission.
- **Target files and symbols:** `AdminDashboardPage.tsx:6`, `AdminUsersPage.tsx:9`, `CreateUserForm.tsx`, admin CSS/tests.
- **Steps:**
  1. Dashboard metrics stack/reflow; không thêm task detail.
  2. Giữ semantic comparison table trong contained horizontal scroll làm mặc định vì source đã có table/min-width behavior; wrap filter controls. Chỉ chuyển sang list/detail nếu baseline task evidence chứng minh scan/action từng account quan trọng hơn comparison. Một `min-width`/scroll container trong source không tự chứng minh page-level overflow.
  3. Giữ `CustomDropdown` tại `AdminUsersPage.tsx:270-300`, confirmations và Edge Function/API hiện có; không dùng native select thô.
  4. Create-user modal có focus trap/restore, keyboard clearance và full-width phone presentation.
- **Success criteria:** Admin filter/search/create/activate/deactivate chạy qua same handlers; user role không truy cập Admin; không lộ personal task details.
- **Verify:** `pnpm --filter @tabdo/web exec vitest run src/pages/__tests__/admin-dashboard-page.test.tsx src/pages/__tests__/admin-users-page.test.tsx src/features/admin/__tests__/admin-create-user-form.test.tsx` exits 0.

## Task 4.4 — Ma trận QA cuối và docs nhỏ nhất

- **Goal:** Có evidence hoàn chỉnh để quyết định ship/rollback và phase doc phản ánh đúng implementation.
- **Target files and symbols:** tạo `plans/261023-1429-mobile-web-ui-ux/reports/final-validation.md`; chỉ sửa `docs/phases/phase-12-mobile-first-web-experience.md` sau PASS thực tế.
- **Steps:**
  1. Run full web test/typecheck/build. Root `pnpm typecheck` và `pnpm build` chỉ chạy nếu shared package/contract bị sửa; kế hoạch mặc định không sửa shared package.
  2. Test 320, 360, 375, 390, 428/430, 768, 1024, 1440; VI/EN dài; 200% zoom; portrait/landscape; keyboard/focus; safe areas.
  3. Test user/admin roles; loading/error/empty/retry; upload; trash; recurrence blocked warning; quick-add/create/edit/complete; calendar agenda/grid; direct links và Back/Forward.
  4. Chạy trên iOS Safari và Android Chrome thật; installed standalone chỉ test navigation/safe area vì manifest hỗ trợ standalone, không tuyên bố offline/push.
  5. So desktop 1024/1440 với baseline. Ghi PASS/FAIL/NOT RUN và artifact. Chỉ sau khi PASS mới cập nhật checklist/DoD Phase 12 bằng claim thực tế.
- **Success criteria:** Không còn FAIL severity cao; mọi acceptance criterion có artifact; mọi NOT RUN còn lại được gọi là blocker/risk, không đổi thành PASS bằng source review.
- **Verify:** `pnpm --filter @tabdo/web test && pnpm --filter @tabdo/web typecheck && pnpm --filter @tabdo/web build` exits 0. Nếu shared package thay đổi, thêm `pnpm typecheck && pnpm build`, cả hai exits 0. `final-validation.md` phải liệt kê iOS Safari, Android Chrome, 320, 390, 430, 768, 1024, 1440 và PASS/FAIL/NOT RUN.

## Test matrix

| Tầng | Phạm vi |
| --- | --- |
| Unit | URL param normalization, agenda grouping/clipping/timezone, state helpers |
| Component | nav/More role entries, task metadata/actions, overlay focus, agenda handlers, forms/admin states |
| Integration | direct link + Back/Forward, task CRUD flow, calendar editor/detail, role switching |
| Rendered/E2E thủ công | viewport/reflow, targets, safe area, keyboard, focus, zoom, landscape, VI/EN, desktop regression |
| Thiết bị thật | iOS Safari và Android Chrome; jsdom/emulation không thay thế |

## Rủi ro và rollback

- **High × High:** QA device chưa chạy nhưng bị hiểu là hoàn tất. Mitigation: evidence labels bắt buộc và NOT RUN là blocker.
- **Medium × High:** Admin responsive làm mất comparison/action. Mitigation: quyết định list hay scroll table từ task/evidence, không ép card.
- Rollback theo feature CSS/page/component của Task 4.1-4.3; docs chỉ revert nếu claim không còn đúng. Không có migration hay backend rollback.

## Failure Protocol
If any Verify step does not meet its stated pass condition, STOP this phase.
Do not improvise a fix, retry blindly, or reason around the failure.
Spawn the `kongming` subagent for next-step counsel and pass:
- the phase and task id,
- what you attempted (the steps you ran),
- the exact command and its full output,
- the pass condition it failed to meet.
Apply kongming's guidance, then re-run the Verify step.
If `kongming` cannot be spawned in this environment, STOP and report the same
failure evidence to the user. Never continue by self-reasoning.
