# Mobile UX audit và decision records

## Trạng thái bằng chứng

- **PASS — baseline automation:** Trên `main@31dc375`, lần chạy 2026-10-23 14:33:52 bằng `pnpm --filter @tabdo/web test -- <four files>` thực tế chạy toàn bộ Web suite và qua 51 files/319 tests trong 25.79s. Đây là baseline logic/component, không chứng minh layout mobile. Không có Vitest/Vite process còn lại.
- **PASS — file-reference metadata:** Fact check `Test-Path` xác nhận 40/40 source/test paths hiện hữu (10 ref/phase × 4 phase). Đây chỉ là kiểm tra path, không phải 40 behavior checks hay UX PASS. Các file mới được ghi rõ là `tạo` nên không thuộc phép đếm.
- **NOT RUN — build gates:** Không chạy typecheck hoặc build trong phiên lập kế hoạch; chúng là Verify bắt buộc khi thực thi từng phase.
- **INFERRED — source:** `AppLayout` dùng fixed sidebar grid 240/68px (`styles.css:19-28`), sticky topbar 56px (`styles.css:470-482`), chưa có mobile bottom navigation (`AppLayout.tsx:35-220`).
- **INFERRED — source:** Task controls gồm search/filter/sort trong cùng flex row (`task-topbar-controls.tsx:27-59`); nguy cơ crowded trên phone cần rendered check.
- **INFERRED — source:** Task actions có opacity 0.35 và lên 1 khi hover (`styles.css:6454-6464`). Đây là giả thuyết affordance bị làm mờ trên touch, không phải bằng chứng action bị ẩn.
- **INFERRED — source:** `TaskDrawer` hỗ trợ Escape (`task-drawer.tsx:28-46`) nhưng markup đang không có `aria-modal`, focus trap/initial focus/restore (`task-drawer.tsx:50-145`).
- **INFERRED — source:** `TasksPage` chỉ sync local state khi `taskId` truthy và close dùng replace (`TasksPage.tsx:59-72`); Back behavior chưa được kiểm thử.
- **INFERRED — source:** Calendar chỉ parse day/week, missing/unknown view normalize week, query range theo day/week (`CalendarPage.tsx:30-73`).
- **INFERRED — source:** Task board đã có single-lane mobile (`styles.css:13052-13071`) và Summary controls đã stack dưới 720px (`styles.css:11082-11098`); kế hoạch phải tái sử dụng thay vì viết lại.
- **NOT RUN:** Không có browser surface trong inventory; toàn bộ rendered layout, device, keyboard, safe area, zoom và touch checks chưa chạy. Không có dev server nào được khởi động.
- **Advice status:** `kongming` advisor đã review và trả `DONE_WITH_CONCERNS`; concern chính là browser/device checks còn `NOT RUN`. Chi tiết tại [kongming-advice.md](./kongming-advice.md).

## Validation log của quyết định người dùng

| Quyết định | Trạng thái | Áp dụng |
| --- | --- | --- |
| Ưu tiên công việc cá nhân, Calendar kế tiếp, Admin tối thiểu | Confirmed | Thứ tự và effort của bốn phase |
| Hỗ trợ cả iPhone và Android | Confirmed | iOS Safari + Android Chrome device checks là acceptance bắt buộc |
| Cho phép đổi phong cách mobile | Confirmed | Mobile visual refresh được phép; desktop visual giữ nguyên; không rebrand/logo/library mới |

## Decision 1 — Navigation mobile

- **Evidence:** INFERRED từ sidebar/topbar fixed và route inventory; rendered usability NOT RUN.
- **Mobile task:** Chuyển nhanh giữa Dashboard, Tasks, Calendar; vẫn tìm được route phụ và Admin theo role.
- **Candidates:** (A) giữ sidebar thu gọn; (B) hamburger cho mọi route; (C) bottom nav 3 task chính + More.
- **Selected:** C, vì có ba peer destination dùng thường xuyên và phase spec đề xuất bottom navigation (`docs/phases/phase-12-mobile-first-web-experience.md:17-25`). More giữ route phụ.
- **Rejected:** A tiếp tục lấy chiều ngang; B tăng thao tác cho ba task ưu tiên. C phải được kiểm tra cạnh keyboard/bottom controls.
- **Preserved:** URLs, direct links, browser history, active state, `profile.role`, một auth session, desktop sidebar.
- **Verify:** 320/390/430 phone + keyboard/touch; user/admin; direct URL, Back, focus restore; status NOT RUN.

## Decision 2 — Task list và hành động

- **Evidence:** INFERRED từ `TaskRow` metadata/recurrence (`task-row.tsx:25-188`) và dim actions CSS; rendered task scan NOT RUN.
- **Mobile task:** Scan, mở và xử lý từng task nhanh mà không cuộn ngang.
- **Candidates:** (A) giữ desktop row co lại; (B) mobile record row/card có metadata ưu tiên; (C) semantic horizontal table.
- **Selected:** B vì task là record triage riêng lẻ, không phải matrix so sánh hai chiều.
- **Rejected:** A dễ crowded; C tăng cuộn ngang mà không phục vụ comparison.
- **Preserved:** title/status/priority/due/recurrence, existing actions/eligibility, filters/sort, list/board param, CRUD/mutations, desktop rows.
- **Verify:** 320/390, long VI/EN, no required sideways scroll, touch/focus action, recurrence blocked warning; status NOT RUN.

## Decision 3 — Task detail và create overlay

- **Evidence:** INFERRED từ desktop modal 1180px/90vh (`styles.css:2369-2393`) và missing focus contract trong `TaskDrawer`; behavior rendered NOT RUN.
- **Mobile task:** Xem/chỉnh sửa task dài, checklist, attachment, reminder, recurrence khi keyboard mở.
- **Candidates:** (A) centered modal thu nhỏ; (B) bottom sheet; (C) full-screen mobile surface dùng component hiện có.
- **Selected:** C vì nội dung/form dài, giữ working area và safe area tốt hơn; desktop vẫn modal.
- **Rejected:** A thiếu không gian; B dễ bị keyboard/height giới hạn.
- **Preserved:** shared `TaskForm`/`TaskDetailView`, handlers, validation, taskId deep link, Escape, nested dialogs, desktop modal.
- **Verify:** focus initial/trap/restore, Escape/close/cancel, keyboard clearance, 200% zoom, four consumer regression; status NOT RUN.

## Decision 4 — Calendar agenda

- **Evidence:** INFERRED từ day/week-only Calendar và Phase 12 yêu cầu agenda trên narrow screen (`phase-12-mobile-first-web-experience.md:36-42`); rendered calendar NOT RUN.
- **Mobile task:** Đọc và mở lịch theo ngày mà không nén week grid, vẫn edit/schedule task.
- **Candidates:** (A) ép day grid; (B) scale week grid; (C) agenda presentation trên cùng day/week range, grid vẫn tùy chọn.
- **Selected:** C, với param độc lập `display=agenda|grid`; missing display dùng responsive default mà không rewrite URL.
- **Rejected:** A làm mất overview week; B khó chạm/đọc trên phone.
- **Preserved:** `view=day|week`, `date`, unknown params, existing range hooks, schedule identity/editor/detail, task deadline, timezone utilities, unscheduled tasks, desktop grid.
- **Verify:** URL tests, midnight/timezone unit tests, agenda touch/keyboard, iOS/Android; status NOT RUN.

## Decision 5 — Admin dense data

- **Evidence:** INFERRED từ filter/search/custom dropdown và lifecycle actions trong `AdminUsersPage.tsx:9-300`; rendered table/list behavior NOT RUN.
- **Mobile task:** Tìm một account và thực hiện action hiện có; Admin không phải ưu tiên comparison sâu trên mobile.
- **Candidates:** (A) mobile list/detail ưu tiên identity/status/action; (B) semantic horizontally scrolling table; (C) full Admin redesign.
- **Selected:** B làm default vì source hiện có dense comparison table; wrap filters và contained scroll. Chỉ chọn A nếu baseline task evidence chứng minh triage từng account quan trọng hơn comparison.
- **Rejected:** C vượt phạm vi; A không được dùng chỉ vì bảng có `min-width`, vì điều đó chưa chứng minh page overflow hay task phù hợp cards.
- **Preserved:** role/status/search/filter/pagination, `CustomDropdown`, confirmations, API/Edge Function, privacy không lộ task details, desktop table.
- **Verify:** 320/390 + user/admin role + create/activate/deactivate + keyboard; status NOT RUN.

## Decision 6 — Art direction mobile

- **Evidence:** User confirmed có thể đổi phong cách mobile; UI mới chưa render nên NOT RUN.
- **Mobile task:** Nhìn nhanh việc cần làm và action kế tiếp, giảm nhiễu thị giác.
- **Candidates:** (A) giống desktop tuyệt đối; (B) calm task-focused refresh; (C) rebrand/native-app visual overhaul.
- **Selected:** B: neutral light canvas, restrained existing blue accent, readable headings, purposeful density và ít decoration.
- **Rejected:** A bỏ lỡ hierarchy mobile; C vượt phạm vi và tăng regression/dependency risk.
- **Preserved:** brand recognition/logo, useful existing tokens/components, desktop appearance, VI/EN, reduced motion; không thêm UI library.
- **Verify:** compare phone screenshots at 320/390/430 and desktop 1024/1440, long text/zoom/contrast; status NOT RUN.

## Nguồn chuẩn

- [W3C Understanding SC 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): nội dung không thuộc ngoại lệ hai chiều cần reflow ở chiều rộng tương đương 320 CSS px.
- [W3C Understanding SC 2.5.8 Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): AA là 24×24 CSS px hoặc exception/spacing hợp lệ. Mục tiêu khoảng 44px của dự án là ergonomic target, không được gọi là ngưỡng WCAG AA.

## Khoảng trống xác minh

Tất cả claim về improvement, target geometry, reflow, contrast, focus, keyboard, safe area, iOS/Android và standalone PWA vẫn `NOT RUN` cho tới khi implementation được render và kiểm tra. Vitest/jsdom có thể chứng minh state/handler/semantics, không chứng minh layout vật lý hoặc platform picker/keyboard.
