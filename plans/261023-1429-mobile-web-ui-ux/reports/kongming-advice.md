# Kongming advice review

**Status:** DONE_WITH_CONCERNS  
**Review date:** 2026-10-23  
**Concern:** không có rendered browser/device evidence; mọi UX result vẫn `NOT RUN`.

## Quyết định đã đưa vào plan

- Bottom nav dùng đúng `/dashboard` với label Dashboard, `/tasks/*` active cho Tasks, Calendar và More cho secondary routes. Tại một breakpoint chỉ expose một navigation tree cho accessibility.
- Calendar `display` độc lập với `view`; missing/invalid display chỉ dùng responsive render default, không effect ghi URL. Explicit display thắng resize; user toggle push history; resize không thêm history; clone và giữ unknown params.
- Week agenda hiển thị toàn range tuần. Agenda chỉ trình bày schedule blocks hiện có, không tạo deadline event. Unscheduled tasks vẫn reachable.
- Task URL helper phải bao phủ mọi selection entry point. Click task push `taskId`; Back đóng và giữ filters; Forward mở lại; direct deep link close replace xóa riêng `taskId`; parent/subtask switch replace trong detail. Không `navigate(-1)` vô điều kiện.
- Escape giữ thứ tự edit → view → close; nested picker/confirm chỉ đóng overlay trên cùng.
- Admin giữ semantic comparison table + contained scroll làm mặc định. Chỉ chuyển cards/list khi baseline task evidence chứng minh cần; `min-width` trong source không phải bằng chứng page overflow.

## Giới hạn review

Review này kiểm tra kiến trúc kế hoạch và failure modes. Nó không thay thế browser QA, device QA, typecheck hoặc build. Baseline duy nhất đã chạy là Web Vitest 51 files/319 tests; typecheck/build chưa chạy trong phiên lập kế hoạch.
