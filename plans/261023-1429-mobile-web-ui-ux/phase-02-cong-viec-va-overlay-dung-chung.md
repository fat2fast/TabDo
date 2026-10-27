---
title: "Phase 02: Công việc và overlay dùng chung"
status: done
priority: P1
effort: "2-3 ngày"
dependencies: [phase-01-baseline-va-mobile-shell]
---

# Phase 02 — Công việc và overlay dùng chung

## Mục tiêu

Làm cho luồng scan → tạo → mở → chỉnh sửa → hoàn thành công việc dùng tốt bằng touch, đồng thời sửa contract focus/URL của overlay dùng chung cho cả bốn consumer.

## Checklist

- [x] Task 2.1 — Mobile task list và controls
- [x] Task 2.2 — Đồng bộ task detail với URL và browser history
- [x] Task 2.3 — Full-screen mobile detail/create và focus contract
- [x] Task 2.4 — Hồi quy bốn consumer và gate phase

## File sở hữu và dependency graph

Mọi đường dẫn bắt đầu bằng `features/` trong phase này được tính từ `apps/web/src/`.

- Sửa `apps/web/src/pages/TasksPage.tsx` (`TasksPage`, `selectedTaskId`, `handleCloseDrawer`).
- Sửa `features/tasks/components/task-row.tsx` (`TaskRow`), `task-list.tsx`, `task-group.tsx`, `task-topbar-controls.tsx`, `task-view-header.tsx`, `quick-add-task.tsx` khi cần presentation.
- Sửa shared overlay `task-drawer.tsx` (`TaskDrawer`) và tái sử dụng `task-detail-view.tsx`, `task-form.tsx`, `task-create-modal.tsx`.
- Tạo `apps/web/src/features/tasks/task-mobile.css`; sửa/add tests dưới `features/tasks/__tests__/`.
- Shared `TaskDrawer` có bốn page consumers: `TasksPage.tsx:351`, `CalendarPage.tsx:307`, `DashboardPage.tsx:152`, `SummaryPage.tsx:129`; mọi prop/focus change phải test cả bốn.
- `TaskTopBarControls` có hai consumers: `AppLayout.tsx:193` và fallback `TasksPage.tsx:253`.

## Task 2.1 — Mobile task list và controls

- **Goal:** Người dùng scan công việc trên phone mà thấy identity và metadata/action bắt buộc, không cần cuộn ngang.
- **Target files and symbols:** `task-row.tsx:25` (`TaskRow`), `task-list.tsx` (`TaskList`), `task-group.tsx` (`TaskGroup`), `task-topbar-controls.tsx:9` (`TaskTopBarControls`), `task-view-header.tsx`, tạo `task-mobile.css`.
- **Steps:**
  1. Chuyển presentation phone thành hàng/card task tập trung: title, status, priority, due date, recurrence summary và action hiện hữu; wrap text, không truncate vĩnh viễn.
  2. Giữ repeat badge đang có tại `task-row.tsx:167-188` và toàn bộ eligibility/action handler hiện hữu.
  3. Làm action trigger nhìn thấy rõ trên touch/focus. Baseline chỉ cho thấy `.task-row-actions` opacity `0.35`, hover lên `1` tại `styles.css:6454-6464`; ghi đây là giả thuyết affordance bị làm mờ, không tuyên bố action bị ẩn.
  4. Trên phone, chuyển search/filter/sort đông chỗ thành search + trigger bộ lọc/sort có active count/state rõ; tái sử dụng `useTaskViewSearchParams`, không tạo store mới.
  5. Giữ board single-lane behavior hiện hữu tại `styles.css:13052-13071` và layout query param; không ép list-only.
- **Success criteria:** Ở 320/390px title/status/priority/due/recurrence và các action hiện có đều reachable; filter/sort/search state không mất khi đóng panel; desktop topbar không đổi.
- **Verify:** `pnpm --filter @tabdo/web exec vitest run src/features/tasks/__tests__/smart-task-views.test.tsx src/features/tasks/__tests__/task-board-ui.test.tsx src/features/tasks/__tests__/task-filters-popover.test.tsx src/features/tasks/__tests__/task-view-search-params.test.ts` exits 0.

## Task 2.2 — Đồng bộ task detail với URL và browser history

- **Goal:** `taskId` trong URL và local selected state luôn đồng bộ cho open, close, direct link và Back/Forward.
- **Target files and symbols:** `TasksPage.tsx:28-73` (`taskIdParam`, `selectedTaskId`, effect, `handleCloseDrawer`), `task-routes.test.tsx` và test search-param tương ứng.
- **Steps:**
  1. Thêm test cho: open task cập nhật `taskId`; param thay đổi hoặc bị xóa cập nhật local state cả hai chiều; close chỉ xóa `taskId`; Back/Forward khôi phục detail/list; query param khác giữ nguyên. Kế hoạch không dùng `--tdd`, nên gate chính là suite phải PASS sau implementation.
  2. Thay effect chỉ-set-khi-truthy tại `TasksPage.tsx:59-64` bằng synchronization xử lý cả `null`.
  3. Hợp nhất mọi entry point chọn task trong TasksPage qua một helper: callbacks `TaskList.onSelectTask`, mọi `TaskGroup.onSelectTask`, `TaskBoard.onSelectTask`, `TaskTrash.onSelectTask` phải push `taskId`; `TaskDrawer.onSelectTask` khi chuyển parent/subtask dùng replace để không tạo close loop.
  4. Close một detail được mở từ app chỉ Back khi history entry đó được chính helper theo dõi an toàn; direct deep link close dùng replace để xóa riêng `taskId`. Không dùng `navigate(-1)` vô điều kiện.
  5. Không khẳng định Back hiện tại đã đúng; chỉ ghi PASS sau test và browser run.
- **Success criteria:** Direct `/tasks/...?...&taskId=x` mở đúng task; close/Back/Forward có observable state nhất quán và không mất filter/sort params.
- **Verify:** `pnpm --filter @tabdo/web exec vitest run src/features/tasks/__tests__/task-routes.test.tsx src/features/tasks/__tests__/task-view-search-params.test.ts` exits 0 and includes assertions for param removal and Back/Forward.

## Task 2.3 — Full-screen mobile detail/create và focus contract

- **Goal:** Detail/create/edit dùng toàn bộ phone viewport, form/action không bị keyboard che, overlay giữ focus an toàn.
- **Target files and symbols:** `task-drawer.tsx:14-147` (`TaskDrawer`), `task-detail-view.tsx`, `task-form.tsx:51` (`TaskForm`), `task-create-modal.tsx:39` (`TaskCreateModal`), `task-mobile.css`, relevant tests.
- **Steps:**
  1. Giữ desktop modal ở `styles.css:2369-2393`; trên phone dùng full-screen surface với safe areas và internal scrolling.
  2. Bổ sung `aria-modal`, initial focus, focus trap, background inert/scroll lock và restore trigger focus; giữ Escape hiện có tại `task-drawer.tsx:28-46`.
  3. Tái sử dụng detail/form tabs, checklist, attachment, reminder, recurrence và related task; không duplicate mutation/query.
  4. Giữ quick-add và create modal; advanced properties còn một thao tác mở, không thêm FAB cạnh tranh bottom nav.
  5. Đảm bảo blocked recurrence reopen vẫn hiện warning rõ qua `useConfirm` và không fail im lặng; không đổi business rule.
  6. Giữ chuỗi Escape edit → view → close; khi có picker/confirm lồng nhau, Escape chỉ đóng overlay trên cùng.
- **Success criteria:** Focus không thoát overlay, Close/Escape/Cancel restore đúng trigger; submit/cancel và focused input vẫn reachable khi keyboard mở; upload/trash/recurrence states giữ nguyên.
- **Verify:** `pnpm --filter @tabdo/web exec vitest run src/features/tasks/__tests__/task-detail-enhancements.test.tsx src/features/tasks/__tests__/task-create-modal.test.tsx src/features/tasks/__tests__/core-task-workflow.test.tsx src/features/tasks/__tests__/task-trash.test.tsx src/features/tasks/__tests__/recurrence.test.ts` exits 0.

## Task 2.4 — Hồi quy bốn consumer và gate phase

- **Goal:** Shared overlay change không làm hỏng Dashboard, Summary hoặc Calendar.
- **Target files and symbols:** tests tại `features/dashboard/__tests__/dashboard-page.test.tsx`, `pages/__tests__/summary-page.test.tsx`, `features/scheduling/__tests__/calendar-page.test.tsx`; không đổi page business logic nếu test không chứng minh cần.
- **Steps:**
  1. Test open/close TaskDrawer từ cả Tasks, Dashboard, Summary, Calendar.
  2. Run full web test, typecheck, build.
  3. Manual/rendered check 320/390/768/1440, VI/EN dài, zoom 200%, landscape, keyboard, touch và keyboard focus.
- **Success criteria:** Bốn consumer dùng cùng TaskDrawer contract và desktop không regress.
- **Verify:** `pnpm --filter @tabdo/web test && pnpm --filter @tabdo/web typecheck && pnpm --filter @tabdo/web build` exits 0; rendered checks được ghi vào `reports/phase-02-validation.md` với PASS/FAIL/NOT RUN.

## Rủi ro và rollback

- **High × High:** URL/local state loop hoặc Back sai. Mitigation: write tests trước, preserve unknown params, không global redesign.
- **High × Medium:** focus trap phá nested confirm/dropdown. Mitigation: test nested overlay và restore stack.
- Rollback: revert task CSS/components/tests; route/data/schema không đổi. Nếu TaskDrawer rollback, rollback đồng thời prop/focus tests của cả bốn consumer.

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
