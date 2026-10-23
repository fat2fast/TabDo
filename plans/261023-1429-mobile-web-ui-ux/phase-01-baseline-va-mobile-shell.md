---
title: "Phase 01: Baseline và mobile shell"
status: done
priority: P1
effort: "1.5-2 ngày"
dependencies: []
---

# Phase 01 — Baseline và mobile shell

## Mục tiêu

Tạo baseline có thể so sánh và một shell mobile responsive dùng chung, trong khi desktop sidebar/topbar và route contract vẫn giữ nguyên. Phase này là blocker của toàn bộ phase sau.

## Checklist

- [x] Task 1.1 — Chụp baseline trước khi sửa CSS
- [x] Task 1.2 — Định nghĩa tokens và art direction mobile
- [x] Task 1.3 — Xây shell phone và tablet
- [x] Task 1.4 — Shell Admin tối thiểu và gate phase

## Bối cảnh và file sở hữu

- Sửa `apps/web/src/features/layout/AppLayout.tsx` (`AppLayout`, `getBreadcrumb`) và `apps/web/src/features/layout/AdminLayout.tsx` (`AdminLayout`).
- Tạo `apps/web/src/features/layout/MobileNavigation.tsx`, `MobileMoreMenu.tsx`, `mobile-shell.css`.
- Sửa `apps/web/src/features/i18n/catalog.ts` các key `nav.*` và test tại `apps/web/src/features/layout/__tests__/portal-layout.test.tsx`, `sidebar-collapse.test.tsx`.
- Có thể sửa `apps/web/src/main.tsx` chỉ để nạp tokens CSS toàn cục; tạo `apps/web/src/mobile-tokens.css`.
- Bằng chứng nguồn: grid sidebar 240/68px ở `apps/web/src/styles.css:19-28`; sticky topbar 56px ở `apps/web/src/styles.css:470-482`; route/role links ở `AppLayout.tsx:27-135`; topbar task controls ở `AppLayout.tsx:185-203`; Admin shell ở `AdminLayout.tsx:10-149`.

## Task 1.1 — Chụp baseline trước khi sửa CSS

- **Goal:** Có ma trận baseline cho mọi route, state và viewport để so sánh sau triển khai.
- **Target files and symbols:** tạo `plans/261023-1429-mobile-web-ui-ux/reports/baseline-results.md`; không sửa source.
- **Steps:**
  1. Ghi commit SHA, trạng thái dirty và browser/device có sẵn.
  2. Với dữ liệu local/non-production, mở từng route trong `App.tsx:23-52` ở 320, 360, 375, 390, 428/430, 768, 1024 và 1440; ghi overflow, focus, navigation, loading/error/empty và ảnh chụp khi có browser.
  3. Lặp lại VI/EN dài, 200% text zoom, landscape, keyboard mở, safe area, user/admin role. Không dùng dữ liệu production.
  4. Nếu không có browser/device, ghi `NOT RUN`, môi trường thiếu và replay steps; không suy diễn PASS từ source. Không bắt đầu sửa global shell/CSS cho tới khi ít nhất Tasks và Calendar baseline đã được render trên browser ở phone + desktop.
- **Success criteria:** Báo cáo có một dòng evidence label cho mỗi route × viewport ưu tiên; Tasks và Calendar có evidence thực chạy, không chỉ `NOT RUN`.
- **Verify:** `test -f plans/261023-1429-mobile-web-ui-ux/reports/baseline-results.md && grep -Eq 'Tasks.*(PASS|FAIL)' plans/261023-1429-mobile-web-ui-ux/reports/baseline-results.md && grep -Eq 'Calendar.*(PASS|FAIL)' plans/261023-1429-mobile-web-ui-ux/reports/baseline-results.md` exits 0. Nếu thiếu browser, Verify không đạt và áp dụng Failure Protocol.

## Task 1.2 — Định nghĩa tokens và art direction mobile

- **Goal:** Có tokens mobile scoped cho spacing, type scale, surface, target, safe area và z-index mà không đổi desktop.
- **Target files and symbols:** tạo `apps/web/src/mobile-tokens.css` (`:root` mobile custom properties); sửa `apps/web/src/main.tsx` import CSS.
- **Steps:**
  1. Giữ font/nhận diện TabDo; dùng nền trung tính sáng, xanh `#0284c7` hiện hữu làm accent, heading dễ đọc và giảm decoration trên phone.
  2. Định nghĩa biến safe-area và chiều cao navigation/header; target ergonomic của dự án hướng tới khoảng 44px khi khả thi, nhưng gate WCAG AA đo 24×24 CSS px hoặc spacing/exception hợp lệ.
  3. Scope mọi thay đổi visual vào media/container mobile; không đổi giá trị desktop hiện có trong `styles.css`.
  4. Tôn trọng `prefers-reduced-motion` và zoom; không thêm dependency.
- **Success criteria:** Tokens có fallback, không override desktop ngoài media mobile, và app vẫn build.
- **Verify:** `pnpm --filter @tabdo/web typecheck` chạy qua WSL interactive shell, exits 0.

## Task 1.3 — Xây shell phone và tablet

- **Goal:** Phone có header gọn và bottom navigation; tablet có compact navigation; desktop vẫn là sidebar/topbar hiện tại.
- **Target files and symbols:** `AppLayout.tsx` (`AppLayout`), tạo `MobileNavigation.tsx` (`MobileNavigation`), `MobileMoreMenu.tsx` (`MobileMoreMenu`), `mobile-shell.css`; `catalog.ts` key VI/EN.
- **Steps:**
  1. Render Dashboard, Tasks, Calendar, More bằng `NavLink`/button semantic và active state từ `location.pathname`; không thay route definitions.
  2. More mở menu có Summary, Monthly report, Settings, language, account và Admin chỉ khi `profile.role === 'admin'`; tái sử dụng `QuickLanguageButton`/`AccountDropdown` hoặc handler hiện hữu.
  3. Trên phone, ẩn sidebar khỏi layout và chừa padding cho bottom nav + `env(safe-area-inset-bottom)`; không thêm FAB bắt buộc vì quick-add/create CTA đã tồn tại.
  4. Trên tablet, dùng compact header/menu nhưng giữ mọi destination; khi trở lại desktop, đóng menu, bỏ inert/scroll lock và restore focus đúng trigger.
  5. More/menu đóng bằng nút, Escape, outside click; chứa focus, khóa background interaction và restore focus. Không dùng swipe-only.
  6. Giữ `TaskTopBarControls` cho desktop; task mobile controls sẽ xử lý ở Phase 02.
  7. Tại mỗi breakpoint chỉ có một cây navigation được expose cho accessibility; navigation desktop bị loại khỏi tab/accessibility tree khi mobile nav hoạt động và ngược lại.
  8. Responsive shell không remount `Outlet`; resize không được làm mất draft form hoặc query state đang mở.
- **Success criteria:** Mọi destination được truy cập bằng touch/keyboard, active state đúng, role gating giống sidebar hiện hữu, content không bị bottom nav che.
- **Verify:** `pnpm --filter @tabdo/web exec vitest run src/features/layout/__tests__/portal-layout.test.tsx src/features/layout/__tests__/sidebar-collapse.test.tsx` exits 0; test assertions gồm user/admin More entries, active route, Escape và focus restore.

## Task 1.4 — Shell Admin tối thiểu và gate phase

- **Goal:** Admin shell có thể điều hướng trên phone mà không đổi auth/role model.
- **Target files and symbols:** `AdminLayout.tsx` (`AdminLayout`), `mobile-shell.css`, `portal-layout.test.tsx`.
- **Steps:**
  1. Dùng compact header/menu cho `/admin/dashboard`, `/admin/users`, và link về User Portal; không tạo bottom nav Admin riêng.
  2. Giữ một session và `AdminRoute`; không chuyển authorization sang CSS/visibility.
  3. Chạy test, typecheck, build; so sánh 390 và 1440 với baseline.
- **Success criteria:** User không thấy Admin entry; admin chuyển hai portal bằng session hiện có; desktop sidebar không đổi.
- **Verify:** `pnpm --filter @tabdo/web test && pnpm --filter @tabdo/web typecheck && pnpm --filter @tabdo/web build` exits 0. Browser checks ở 390/768/1440 phải được ghi `PASS` hoặc `FAIL`; nếu chưa có browser phải ghi `NOT RUN`, không được coi phase hoàn tất UX.

## Rủi ro và rollback

- **High × High:** bottom nav/menu che form hoặc làm scroll lock kẹt. Mitigation: safe-area, keyboard và focus lifecycle checks trước khi sang Phase 02.
- **Medium × High:** menu role gating khác sidebar. Mitigation: derive từ cùng `profile.role` và test user/admin.
- Rollback: revert bốn component/CSS mới, catalog/tests và import tokens; shell trở lại sidebar/topbar cũ, không có migration.

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
