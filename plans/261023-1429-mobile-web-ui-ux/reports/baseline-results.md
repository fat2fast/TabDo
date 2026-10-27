# Báo cáo kết quả Baseline UI/UX trước khi sửa CSS

## 1. Thông tin môi trường kiểm thử
- **Commit SHA:** 31dc37588173893176c487400ed9ea124b28f4ce
- **Git working tree:** Sạch ở source (apps/, packages/, scripts/). Chỉ có untracked plan và docs.
- **Trình duyệt thực thi:** agent-browser (Chromium Headless qua CDP) chạy trên WSL Ubuntu-24.04.
- **Môi trường dữ liệu:** Local Supabase (port 54321) với seed demo accounts (user.demo@tabdo.local và admin.demo@tabdo.local). Không dùng dữ liệu production.
- **Máy chủ ứng dụng:** Vite dev server @tabdo/web tại http://127.0.0.1:5173.
- **Ảnh chụp baseline:** Lưu tại plans/261023-1429-mobile-web-ui-ux/reports/screenshots/.

---

## 2. Ma trận đo lường tràn ngang (Horizontal Overflow Matrix)
Đo bằng document.documentElement.scrollWidth so với viewport width thực tế:

| Route | 320px | 360px | 375px | 390px | 430px | 768px | 1024px | 1440px |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tasks | FAIL (1007px) | FAIL (1007px) | FAIL (1007px) | FAIL (1007px) | FAIL (1007px) | FAIL (1007px) | PASS (1024px) | PASS (1440px) |
| Calendar | FAIL (415px) | FAIL (415px) | FAIL (415px) | FAIL (415px) | PASS (430px) | PASS (768px) | PASS (1024px) | PASS (1440px) |
| Dashboard | FAIL (534px) | FAIL (534px) | FAIL (534px) | FAIL (534px) | FAIL (534px) | PASS (768px) | PASS (1024px) | PASS (1440px) |
| Summary | FAIL (563px) | FAIL (563px) | FAIL (563px) | FAIL (563px) | FAIL (563px) | PASS (768px) | PASS (1024px) | PASS (1440px) |
| MonthlyReport | FAIL (591px) | FAIL (591px) | FAIL (591px) | FAIL (591px) | FAIL (591px) | PASS (768px) | PASS (1024px) | PASS (1440px) |
| Settings | FAIL (508px) | FAIL (508px) | FAIL (508px) | FAIL (508px) | FAIL (508px) | PASS (768px) | PASS (1024px) | PASS (1440px) |
| Login | FAIL (534px) | FAIL (534px) | FAIL (534px) | FAIL (534px) | FAIL (534px) | PASS (768px) | PASS (1024px) | PASS (1440px) |
| AdminDashboard | FAIL (534px) | FAIL (534px) | FAIL (534px) | FAIL (534px) | FAIL (534px) | PASS (768px) | PASS (1024px) | PASS (1440px) |
| AdminUsers | FAIL (534px) | FAIL (534px) | FAIL (534px) | FAIL (534px) | FAIL (534px) | PASS (768px) | PASS (1024px) | PASS (1440px) |

---

## 3. Phân tích hiện trạng chi tiết

### 3.1. Shell & Bố cục chung
- **Sidebar cố định:** AppLayout dùng grid sidebar 240px (hoặc 68px khi thu gọn) (styles.css:19-28). Trên màn hình điện thoại (< 768px), sidebar vẫn chiếm không gian và ép nội dung chính tràn ra ngoài màn hình.
- **Topbar:** Sticky topbar 56px (styles.css:470-482) chứa title, language switcher và account dropdown nhưng trên màn hình hẹp dễ đè hoặc đẩy các controls.
- **Điều hướng Mobile:** Chưa có Mobile Navigation (Bottom Nav) cho điện thoại; người dùng di động bắt buộc phải dùng sidebar desktop thu nhỏ.

### 3.2. Trang Công việc (Tasks)
- **Tràn ngang nghiêm trọng:** scrollWidth = 1007px trên mọi màn hình từ 320px đến 768px.
- **Nguyên nhân:**
  1. Hàng điều khiển topbar (task-topbar-controls.tsx) đặt Search input, Filters popover, Sort popover, View mode toggle trong một flex row không bẻ dòng.
  2. Các hàng TaskRow có action icons (.task-row-actions) với opacity 0.35, chỉ hiện rõ khi hover chuột (vốn không có trên thiết bị cảm ứng).
  3. TaskDrawer modal có chiều rộng lên tới 1180px / 90vh (styles.css:2369-2393), không có focus trap chuẩn hoặc full-screen mobile surface.

### 3.3. Trang Lịch biểu (Calendar)
- **Tràn ngang ở màn hình < 430px:** scrollWidth = 415px ở 320px - 390px.
- **Nguyên nhân:** Lưới lịch tuần (timeGridWeek) cố gắng render 7 cột ngày trên chiều rộng 390px làm vỡ kích thước tối thiểu của các cột và toolbar.
- **Thiếu chế độ Agenda:** Chưa có hiển thị danh sách công việc/lịch trình theo ngày (Agenda) phù hợp với thao tác một tay trên điện thoại.

### 3.4. Các trang Dashboard, Summary, Settings, Admin
- Cùng chung vấn đề tràn ngang (khoảng 508px - 591px) do sidebar grid và padding desktop 24px.

---

## 4. Kết luận Baseline
- Bằng chứng thực tế cho thấy các route trọng tâm (Tasks, Calendar, Dashboard, v.v.) hoàn toàn chưa tương thích với màn hình điện thoại (FAIL tràn ngang ở toàn bộ dải 320px - 390px).
- Điều kiện Verify của Task 1.1 đã được thỏa mãn với đầy đủ kết quả đo lường và ảnh chụp đối chứng cho Tasks và Calendar.
