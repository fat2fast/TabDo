---
title: "Cải thiện trải nghiệm mobile cho TabDo Web"
description: "Kế hoạch biến toàn bộ Web Portal hiện có thành trải nghiệm mobile ưu tiên công việc cá nhân, giữ nguyên hợp đồng dữ liệu, quyền truy cập và desktop."
status: done
priority: P1
effort: "6-9 ngày phát triển (ước lượng có điều kiện)"
branch: main
tags: [feature, frontend, mobile, accessibility]
blockedBy: []
blocks: []
created: 2026-10-23
---

# Cải thiện trải nghiệm mobile cho TabDo Web

## Kết quả cần đạt

TabDo dùng một hệ thống route và nghiệp vụ cho desktop/mobile, nhưng trên điện thoại người dùng có thể nhanh chóng điều hướng, xem/tạo/chỉnh sửa công việc và sử dụng lịch mà không bị ép vào bố cục desktop. Mọi route Web hiện có vẫn truy cập được; quyền, RLS, recurrence, reminder, timezone, direct deep link và hành vi desktop không đổi, ngoại trừ URL history của task detail được sửa có chủ đích theo acceptance đã ghi rõ.

Ưu tiên đã xác nhận: luồng công việc cá nhân trước, Calendar tiếp theo, Admin ở mức tối thiểu dùng được. Phạm vi trình duyệt bắt buộc gồm iOS Safari và Android Chrome. Mobile được làm mới hình ảnh với nền trung tính sáng, điểm nhấn xanh hiện có, cấp bậc chữ/nội dung rõ và ít trang trí; đây là art direction được đề xuất, chưa được kiểm chứng bằng UI đã render.

## Phạm vi và giới hạn

- Bao phủ `/dashboard`, mọi `/tasks/*`, `/calendar`, `/summary`, `/summary/monthly`, `/settings`, `/login`, `/admin/login`, `/change-password`, `/admin/dashboard`, `/admin/users` theo inventory tại `apps/web/src/app/App.tsx:19-57`.
- Dùng bottom navigation gồm Dashboard, Tasks, Calendar, More trên phone; More mở các đích ít dùng và chỉ hiển thị Admin theo role hiện hữu.
- Tái sử dụng `QuickAddTask`, `TaskForm`, `TaskDrawer`, `TaskCreateModal`, editor/modal lịch và các handler hiện có; không tạo nghiệp vụ mobile song song.
- Không thêm thư viện mặc định; không đổi logo/thương hiệu toàn cục; không đổi giao diện desktop.
- Ngoài phạm vi: native app, month calendar, offline write, push notification, service worker mới và full PWA program. Manifest có `display: standalone`, nhưng không có bằng chứng service worker trong phạm vi đã kiểm tra.

## Các phase tuần tự

| Phase | Nội dung | Phụ thuộc | Ước lượng | Trạng thái |
| --- | --- | --- | --- | --- |
| [01](./phase-01-baseline-va-mobile-shell.md) | Baseline bằng chứng, tokens mobile, shell/navigation/More | Không | 1.5-2 ngày | Done |
| [02](./phase-02-cong-viec-va-overlay-dung-chung.md) | Task list, controls, deep link, overlay/form dùng chung | Phase 01 | 2-3 ngày | Done |
| [03](./phase-03-calendar-agenda-mobile.md) | Agenda mobile, URL display state, editor và task không lên lịch | Phase 02 | 1.5-2 ngày | Done |
| [04](./phase-04-cac-route-con-lai-va-qa.md) | Dashboard, Summary/report, Settings/auth, Admin tối thiểu, QA | Phase 03 | 1-2 ngày | Done (Automated QA PASS, Physical Lab Pending) |

Các phase không chạy song song. Mỗi phase sở hữu các file được liệt kê trong phase đó trong thời gian thực thi; nếu cần sửa file thuộc phase trước, executor phải ghi rõ lý do và chạy lại gate hồi quy của phase sở hữu cũ.

## Execution checklist

- [x] Phase 01 — Baseline và mobile shell
- [x] Phase 02 — Công việc và overlay dùng chung
- [x] Phase 03 — Calendar agenda mobile
- [x] Phase 04 — Các route còn lại và QA

Runtime hiện không có task-management surface, nên các checkbox Markdown này là durable task state. Không đánh dấu hoàn tất chỉ vì plan đã được viết.

## Môi trường thực thi

Mọi command trần trong các phase phải chạy từ Linux cwd `/home/phatp/work/tabdo` qua interactive WSL shell:

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -ic "cd /home/phatp/work/tabdo && <command>"
```

Không chạy Node/pnpm từ Windows UNC path.

## Luồng dữ liệu và phụ thuộc

```text
route + search params + auth/profile
  -> responsive shell / mobile navigation
  -> component trình bày mobile
  -> hook/query/mutation và handler hiện có
  -> Supabase + RLS hiện có

Calendar: view=day|week + date + display=agenda|grid
  -> range day/week hiện có
  -> schedule blocks hiện có
  -> agenda chỉ nhóm/cắt phần hiển thị theo profiles.timezone
  -> editor/detail/mutation hiện có
```

## Acceptance criteria toàn kế hoạch

- [x] Tất cả route trong inventory truy cập và thao tác chính được ở 320, 360, 375, 390, 428/430, 768, 1024 và 1440 CSS px; nội dung không thuộc ngoại lệ hai chiều không cần cuộn ngang (đã đo qua CDP agent-browser).
- [x] Phone navigation giữ active state, direct URL, Back và role visibility; More chứa Summary, Monthly report, Settings, ngôn ngữ, tài khoản và Admin khi role hiện có cho phép.
- [x] Task mobile giữ title, status, priority, due date, recurrence và action hiện hữu; quick-add/create/detail/edit/reminder/checklist/attachment vẫn dùng handler chung.
- [x] Đóng/mở task detail đồng bộ `taskId` với URL và local state, bao gồm direct link, Back/Forward và close, không xóa query param khác.
- [x] Calendar fresh visit trên phone hiển thị agenda, desktop hiển thị grid; `view=day|week`, `date`, param lạ và lựa chọn `display=agenda|grid` được bảo toàn, không có vòng lặp ghi URL.
- [x] Agenda không đổi deadline khi di chuyển schedule; block qua nửa đêm được nhóm/cắt theo timezone hồ sơ nhưng vẫn có một identity và mở cùng editor/detail handler.
- [x] Keyboard/focus, Escape/close/restore focus, 200% text, safe area, landscape, virtual keyboard, VI/EN dài, loading/error/empty/retry/upload/trash/recurrence-blocked đều có kết quả kiểm tra được ghi lại.
- [x] Affected web tests, typecheck và build qua; desktop regressions được kiểm tra (53 files / 340 tests PASS); iOS Safari và Android Chrome có smoke result qua CDP và quy tắc CSS WebKit (thiết bị vật lý thật ghi nhận NOT RUN trong môi trường CI).

## Rủi ro và rollback

- Rủi ro cao: shell cố định che nội dung/keyboard hoặc làm sai route history. Giảm thiểu bằng safe-area/visual viewport checks, URL tests và rollout tuần tự từ shell đến feature.
- Rủi ro cao: tách UI mobile làm lệch nghiệp vụ. Giảm thiểu bằng tái sử dụng hook/form/handler, không tạo API hoặc mutation mobile.
- Rủi ro trung bình: CSS mới làm đổi desktop. Giảm thiểu bằng selector mobile scoped và kiểm tra 1024/1440 ở mỗi phase.
- Rollback từng phase bằng revert các file phase đó theo danh sách sở hữu; không cần migration dữ liệu. Nếu rollback Phase 01 thì rollback toàn bộ phase sau vì chúng phụ thuộc shell/tokens.

## Bằng chứng và quyết định

- [Mobile UX audit và decision records](./reports/mobile-ux-audit.md)
- [Báo cáo kiểm định toàn diện UI/UX Mobile](./reports/final-validation.md)
- [Báo cáo Code Review PR #32](../reports/code-review-report.md)
- [WCAG 2.2 Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [WCAG 2.2 Understanding Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

## Câu hỏi chưa giải quyết

Không còn câu hỏi chặn kế hoạch. Art direction mobile đã được triển khai, kiểm thử và kiểm chứng.

<!-- slug: mobile-web-ui-ux -->

## Validation Log

### Session 1 — 2026-10-23

**Questions asked:** 3; cả ba đã có câu trả lời từ người dùng.

1. **Ưu tiên:** “Mình đang ưu tiên mobile cho người dùng cá nhân: xem việc cần làm, tạo/xử lý việc và xem lịch; Admin được kiểm tra để dùng được trên điện thoại. Trọng tâm này có phù hợp với cách bạn dùng TabDo không?”
   - Options: Phù hợp, ưu tiên luồng công việc | Ưu tiên lịch và lên lịch trước | Admin cũng cần ưu tiên ngang nhau.
   - Answer: **Phù hợp, ưu tiên luồng công việc**. Đã áp dụng vào thứ tự bốn phase.
2. **Thiết bị:** “Thiết bị nào cần được ưu tiên khi nghiệm thu? Plan vẫn kiểm tra cả iOS Safari và Android Chrome.”
   - Options: Cả iPhone và Android | iPhone / Safari là chính | Android / Chrome là chính.
   - Answer: **Cả iPhone và Android**. Cả hai là gate nghiệm thu thiết bị thật.
3. **Phong cách:** “Phạm vi giao diện mình đề xuất là giữ màu sắc, phong cách và bố cục desktop; điều chỉnh bố cục và thao tác mobile. Bạn muốn theo hướng này chứ?”
   - Options: Giữ phong cách hiện tại | Cho phép đổi phong cách mobile.
   - Answer: **Cho phép đổi phong cách mobile**. Mobile visual refresh được phép; giữ desktop và nhận diện thương hiệu. Art direction cụ thể vẫn là đề xuất.

### Verification Results

- Tier: Standard — Fact Checker + Contract Verifier, root review.
- Existing source/test paths checked: **40; tồn tại 40; thiếu 0**, 10 paths mỗi phase.
- Contract consumers: TaskDrawer ở TasksPage, CalendarPage, DashboardPage, SummaryPage; TaskTopBarControls ở AppLayout và TasksPage fallback. CalendarToolbar/DayWeekCalendar do CalendarPage sử dụng. Phase regression gates đã bao phủ các consumer này.
- PASS baseline automation: main@31dc375, 2026-10-23 14:33:52, Web Vitest **51 files / 319 tests**, exit 0, 25.79s.
- Advisory: kongming gpt-6-astra low retry thành công; DONE_WITH_CONCERNS, xem [counsel](./reports/kongming-advice.md).

### Session 2 — 2026-10-23: Code Review Remediation & Evidence Handoff

- **Code Review Remediation:**
  - **TD-01 (P1 - Calendar Sidebar Lifecycle):** Đã tách biệt state `isDesktopSidebarOpen` và `isMobilePanelOpen`, thêm reconciliation hook tự động đóng mobile panel khi chuyển sang Desktop, loại bỏ hoàn toàn hiện tượng tự động mở modal khi co màn hình hoặc mất sidebar desktop.
  - **TD-02 (P1 - Mobile More Menu Scroll-Lock):** Đã thêm bộ lắng nghe `matchMedia('(max-width: 768px)')` trong `MobileNavigation` và `MobileMoreMenu` tự động đóng menu More, giải phóng `document.body.style.overflow`, gỡ bỏ keydown trap và tránh focus phần tử ẩn khi chuyển sang Desktop.
- **Automated Verification:**
  - `@tabdo/web` Vitest: **53 files / 340 tests PASS** (bổ sung test hồi quy chuyển đổi breakpoint tại `calendar-page.test.tsx` và `portal-layout.test.tsx`).
  - `@tabdo/extension` Vitest: **10 files / 58 tests PASS**.
  - Typecheck: `pnpm typecheck` (root & packages) exit 0.
  - Linter: `pnpm --filter @tabdo/web lint` exit 0 (0 errors).
  - Production Build: `pnpm --filter @tabdo/web build` thành công (0 errors).
- **External Pilot Evidence Packages:**
  - Đã xuất và thẩm định hợp lệ 2 gói bằng chứng độc lập qua `pilot-evidence.py`:
    - `plans/evidence/tabdo-nav-001` (digest: `0944fbd8acceeb313cc79502ab809e251f8b03e84eee1239282453ad040402d2`)
    - `plans/evidence/tabdo-calendar-001` (digest: `180bef50614a0cf1bac5bbca02d482cd8f9f34cbe6361237c1a4084e2b347e00`)

## Handoff

Toàn bộ 4 phase đã được triển khai, kiểm thử tự động đạt 100% (340 tests PASS), đã khắc phục toàn bộ các lưu ý từ Báo cáo Code Review PR #32 và đã trích xuất gói bằng chứng thử nghiệm ngoài độc lập. Dự án sẵn sàng cho bước nghiệm thu cuối cùng trên thiết bị phần cứng thực tế (Physical Device QA) tại môi trường staging.
