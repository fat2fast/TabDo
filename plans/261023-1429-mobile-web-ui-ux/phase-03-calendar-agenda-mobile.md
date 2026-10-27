---
title: "Phase 03: Calendar agenda mobile"
status: done
priority: P1
effort: "1.5-2 ngày"
dependencies: [phase-02-cong-viec-va-overlay-dung-chung]
---

# Phase 03 — Calendar agenda mobile

## Mục tiêu

Thêm agenda làm presentation mặc định responsive trên phone, giữ nguyên day/week query range, schedule identity, editor/detail handler và deadline semantics.

## Checklist

- [x] Task 3.1 — Tách `display` khỏi range `view`
- [x] Task 3.2 — Chuẩn hóa agenda items theo timezone
- [x] Task 3.3 — Render agenda và giữ editor/detail/unscheduled tasks
- [x] Task 3.4 — Gate phase và device check

## File sở hữu

Mọi đường dẫn bắt đầu bằng `features/` trong phase này được tính từ `apps/web/src/`.

- Sửa `apps/web/src/pages/CalendarPage.tsx` (`CalendarPage`, URL parsing, `visibleRange`, handlers).
- Sửa `features/scheduling/components/calendar-toolbar.tsx` (`CalendarToolbar`) khi thêm display selector.
- Tạo `features/scheduling/components/mobile-agenda.tsx`, `features/scheduling/utils/agenda-items.ts`, `features/scheduling/calendar-mobile.css`.
- Sửa/add `features/scheduling/__tests__/calendar-page.test.tsx`, tạo `agenda-items.test.ts` và `mobile-agenda.test.tsx`.
- Không đổi `day-week-calendar.tsx` business behavior, `api/schedule-blocks.ts`, mutation hooks hoặc schema trừ khi evidence mới chứng minh cần.

## Task 3.1 — Tách `display` khỏi range `view`

- **Goal:** URL phân biệt range (`view=day|week`) với presentation (`display=agenda|grid`) mà không phá link cũ.
- **Target files and symbols:** `CalendarPage.tsx:20-103` (`rawView`, `rawDate`, URL normalization, `visibleRange`, handlers), `calendar-page.test.tsx`.
- **Steps:**
  1. Giữ `view=day|week` và `date` semantics hiện hữu; raw view khác `day` đang normalize sang `week` tại `CalendarPage.tsx:30-63`.
  2. Parse optional `display=agenda|grid`; explicit valid value luôn thắng responsive default qua mọi resize.
  3. Khi thiếu hoặc invalid `display`, chọn agenda trên phone và grid trên desktop chỉ ở render state, không chạy effect ghi URL; resize có thể đổi responsive default nhưng không thêm history entry.
  4. Khi user đổi display, clone `URLSearchParams`, chỉ set `display` bằng push history, giữ `view`, `date` và unknown params.
  5. Direct links cũ thiếu display vẫn hoạt động; không migration.
- **Success criteria:** Fresh phone visit render agenda, fresh desktop render grid; explicit display ổn định qua reload/resize; unknown params còn nguyên.
- **Verify:** `pnpm --filter @tabdo/web exec vitest run src/features/scheduling/__tests__/calendar-page.test.tsx` exits 0 and includes missing/explicit/unknown-param cases.

## Task 3.2 — Chuẩn hóa agenda items theo timezone

- **Goal:** Schedule blocks trong day/week range được nhóm theo ngày hồ sơ và cắt presentation đúng khi qua nửa đêm, không nhân identity hoặc đổi dữ liệu.
- **Target files and symbols:** tạo `features/scheduling/utils/agenda-items.ts` (`buildAgendaItems` hoặc tên tương đương), `agenda-items.test.ts`; dùng API public hiện hữu từ `@tabdo/utils`, không thêm helper trùng lặp.
- **Steps:**
  1. Input chỉ gồm schedule blocks đã fetch, visible range và `profile.timezone` fallback `Asia/Ho_Chi_Minh` như `CalendarPage.tsx:20-23`.
  2. Nhóm/cắt phần hiển thị theo local day; mỗi segment mang cùng block id và reference gốc.
  3. Clamp phần hiển thị vào visible range; không mutation `startAt`, `endAt`, task deadline hoặc server row.
  4. Sort deterministic theo local day/start/end/id; test DST-capable timezone và Asia/Ho_Chi_Minh.
- **Success criteria:** Block qua midnight xuất hiện ở đúng ngày với một underlying identity; click segment trả block gốc; không thay dữ liệu nguồn.
- **Verify:** `pnpm --filter @tabdo/web exec vitest run src/features/scheduling/__tests__/agenda-items.test.ts` exits 0 with same-id, midnight, range-clipping and timezone assertions.

## Task 3.3 — Render agenda và giữ editor/detail/unscheduled tasks

- **Goal:** Phone agenda cho phép xem, mở, sửa schedule và truy cập task chưa lên lịch qua các handler hiện có.
- **Target files and symbols:** tạo `mobile-agenda.tsx` (`MobileAgenda`), `calendar-mobile.css`; sửa `CalendarPage.tsx:213-310`, `calendar-toolbar.tsx:16`; tests.
- **Steps:**
  1. Render nhóm ngày với thời gian, title, existing `taskId` link khi block có liên kết và empty/loading/error states; `view=week&display=agenda` hiển thị cả range tuần. Không fetch hay sáng tạo task status mới.
  2. `onEventClick` gọi cùng `ScheduleDetailModal`; edit gọi cùng `ScheduleEditor`; open task dùng same `TaskDrawer`.
  3. Grid tiếp tục dùng `DayWeekCalendar`; agenda không hỗ trợ drag như đường duy nhất. Move/resize chỉ qua handler/editor có sẵn và không đổi deadline.
  4. Giữ `UnscheduledTasks` reachable bằng explicit mobile control/panel, với focus trap/restore theo Phase 02.
  5. Toolbar dùng custom controls hiện có, không thêm native `<select>` không style.
- **Success criteria:** Người dùng chọn ngày/range/display, mở schedule, edit, open linked task và truy cập unscheduled tasks bằng touch/keyboard; desktop grid giữ nguyên.
- **Verify:** `pnpm --filter @tabdo/web exec vitest run src/features/scheduling/__tests__/calendar-page.test.tsx src/features/scheduling/__tests__/schedule-detail-modal.test.tsx src/features/scheduling/__tests__/schedule-editor.test.tsx src/features/scheduling/__tests__/mobile-agenda.test.tsx` exits 0.

## Task 3.4 — Gate phase và device check

- **Goal:** Calendar mobile được kiểm tra bằng rendered browser và không phá desktop.
- **Target files and symbols:** tạo `plans/261023-1429-mobile-web-ui-ux/reports/phase-03-validation.md`; không đổi implementation trong bước ghi kết quả.
- **Steps:**
  1. Run full web test/typecheck/build.
  2. Kiểm tra 320/390/430/768/1440; day/week; agenda/grid; block qua midnight; empty/loading/error; unscheduled tasks; keyboard/focus.
  3. Kiểm tra thật trên iOS Safari và Android Chrome, gồm landscape, safe area và keyboard; emulation/jsdom không thay cho mục này.
- **Success criteria:** Kết quả có browser/device/version, scenario, expected/actual và PASS/FAIL; mục không chạy ghi NOT RUN và vẫn là blocker cho acceptance cuối.
- **Verify:** `pnpm --filter @tabdo/web test && pnpm --filter @tabdo/web typecheck && pnpm --filter @tabdo/web build` exits 0; report tồn tại và chứa cả `iOS Safari` lẫn `Android Chrome`.

## Rủi ro và rollback

- **High × High:** display default tạo URL loop hoặc đổi range fetch. Mitigation: không ghi param mặc định, test query range độc lập.
- **High × Medium:** midnight split tạo duplicate mutation. Mitigation: segment giữ block gốc và một id mutation.
- Rollback: xóa agenda/utils/CSS/tests, revert CalendarPage/toolbar; URL cũ day/week tiếp tục hoạt động, không có data migration.

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
