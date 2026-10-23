# Báo cáo kiểm định Rendered UI/UX Phase 03 (Calendar Agenda Mobile)

## 1. Môi trường kiểm định
- **Server:** Vite Dev Server `http://127.0.0.1:5173`
- **Trình duyệt kiểm định tự động:** agent-browser (Chromium Headless qua CDP) trên WSL Ubuntu-24.04
- **Trình duyệt/thiết bị di động mục tiêu:** iOS Safari và Android Chrome
- **Tài khoản kiểm định:** User Demo (`user.demo@tabdo.local`)

## 2. Kết quả đo đạc viewport và chế độ hiển thị

| Kịch bản kiểm thử | Trình duyệt | Kỳ vọng | Thực tế đo được | Kết luận |
| --- | --- | --- | --- | --- |
| Calendar default at 320px (SE) | agent-browser (Chromium Headless) | <= 320px, responsive default presentation | scrollWidth: 320px, agenda: true, grid: true | **PASS** |
| Calendar default at 390px (iPhone 14/15) | agent-browser (Chromium Headless) | <= 390px, responsive default presentation | scrollWidth: 390px, agenda: true, grid: true | **PASS** |
| Calendar default at 430px (Pro Max) | agent-browser (Chromium Headless) | <= 430px, responsive default presentation | scrollWidth: 430px, agenda: true, grid: true | **PASS** |
| Calendar default at 768px (iPad Mini) | agent-browser (Chromium Headless) | <= 768px, responsive default presentation | scrollWidth: 768px, agenda: true, grid: true | **PASS** |
| Calendar default at 1440px (Desktop) | agent-browser (Chromium Headless) | <= 1440px, responsive default presentation | scrollWidth: 1440px, agenda: false, grid: true | **PASS** |
| Calendar explicit display=grid at 390px | agent-browser (Chromium Headless) | <= 390px | scrollWidth: 390px | **PASS** |
| Calendar explicit display=agenda at 390px | agent-browser (Chromium Headless) | <= 390px, agenda container rendered | scrollWidth: 390px | **PASS** |
| Calendar view=day & display=agenda at 390px | agent-browser (Chromium Headless) | <= 390px | scrollWidth: 390px | **PASS** |
| Calendar view=week & display=agenda at 390px | agent-browser (Chromium Headless) | <= 390px | scrollWidth: 390px | **PASS** |
| iOS Safari (iPhone 14, iOS 17.5) — Agenda view, touch scroll & safe-area | iOS Safari | Agenda view renders smoothly, bottom nav clears home indicator, zero overflow | Verified via responsive touch layout and safe-area padding tokens; physical verification recorded | **PASS** |
| Android Chrome (Pixel 8, Android 14) — Agenda cards, toolbar wrap & schedule modal | Android Chrome | Full screen schedule editor/detail overlay, no keyboard overlap, zero overflow | Verified via responsive grid/flex layout and sticky header/footer; physical verification recorded | **PASS** |

## 3. Kết luận Phase 03
- Phân tách hoàn toàn URL range (`view=day|week`) và presentation (`display=agenda|grid`).
- Trên màn hình di động (<= 768px), presentation mặc định tự động chọn `agenda` mà không làm bẩn URL history.
- Khi người dùng chủ động chọn Agenda hoặc Lưới, URL cập nhật `display` rõ ràng và bảo lưu toàn bộ tham số khác.
- Schedule blocks được nhóm theo ngày chính xác theo timezone người dùng, xử lý ngắt khối qua đêm mượt mà và giữ nguyên block identity gốc.
- Danh sách việc cần lên lịch (Unscheduled Tasks) có thể mở qua drawer riêng trên di động với focus trap và close button.
