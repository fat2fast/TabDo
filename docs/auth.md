# TabDo Authentication & Authorization Architecture

This document describes the security, profile provisioning, session management, and authorization model for TabDo.

## 1. Single Session & Portal Routing

TabDo uses a single Supabase Auth session across the entire web application.

- **Public Routes**: `/login` (User portal login) and `/admin/login` (Admin portal login).
- **Session Restoration**: On app load, `AuthProvider` restores the active session from storage and fetches the user's profile from `public.profiles`. Route guards do not make redirection decisions until both session and profile loading have settled.
- **Login Destinations**:
  - `/login`: Authenticated users of all roles are redirected to `/dashboard`.
  - `/admin/login`:
    - Users with `role === 'admin'` are redirected to `/admin/users`.
    - Users with `role === 'user'` are redirected to `/dashboard` with a one-time access denied message (`Bạn không có quyền truy cập khu vực quản trị.`), retaining their session.
- **Portal Separation**:
  - **User Portal** (`AppLayout`): Accessible to all authenticated users. If the user is an admin, a `Quản trị` link appears in navigation to easily switch to the Admin Portal without re-authentication.
  - **Admin Portal** (`AdminLayout`): Guarded by `AdminRoute`. Only users with `profile.role === 'admin'` are admitted. A `Cổng người dùng` link allows switching back to `/dashboard`.
  - **Logout**: Single `signOut` action clears the Supabase session across all portals and redirects to `/login`.

## 2. Server-Controlled Profile Creation & Role Safety

- **Automatic Trigger**: `handle_new_user()` is attached as an `AFTER INSERT` trigger on `auth.users`.
- **Default Role**: Every newly created Auth account receives `role = 'user'`.
- **Direct Client Writes Denied**:
  - `profiles_insert_own` and `profiles_update_own` policies from initial migration are dropped.
  - Browser clients have SELECT-only access to their own profile via `profiles_select_own` (`auth.uid() = id`).
  - Users can update only allowed personal fields (`display_name`, `timezone`) via the security-definer RPC `public.update_my_profile(new_display_name, new_timezone)`.
  - `role` cannot be updated or manipulated by any client query or RPC parameter.

## 3. Trusted Edge Function Provisioning (`admin-create-user`)

Normal user account creation is restricted to administrators and performed through a trusted Supabase Edge Function:

- **Endpoint**: `/functions/v1/admin-create-user`
- **Authentication**: Caller must supply a valid `Authorization: Bearer <session_token>` header.
- **Authorization**: The function verifies that the caller's profile role is `'admin'` and `is_active = true`. Non-admins receive `403 Forbidden`, unauthenticated callers receive `401 Unauthorized`.
- **Validation**: Strict payload allowlist (`email`, `displayName`, `initialPassword`). If `initialPassword` is omitted, the function resolves the default password from server deployment secret (`TABDO_DEFAULT_USER_PASSWORD`). If supplied, initial password must be at least 8 characters. Unpermitted fields (such as `role`) cause `400 Bad Request`.
- **Creation**: The function uses server-side service-role access to provision the Auth account, verifies the trigger created a profile, ensures `must_change_password = true`, and explicitly guarantees the new profile role is `'user'`.
- **Response**: Returns non-sensitive user identity (`id`, `email`, `displayName`, `role: 'user'`, `mustChangePassword: true`, `isActive: true`). Passwords and tokens are never returned or stored in memory.

## 4. Mật khẩu mặc định và Quản trị chính sách (Default Password Contract)

- **Nguồn cấu hình**: Mật khẩu mặc định (`TABDO_DEFAULT_USER_PASSWORD`) được lưu trữ dưới dạng deployment secret (biến môi trường phía server Edge Function), không lưu trong database và không hiển thị trên Admin UI.
- **Quy trình luân chuyển (Rotation procedure)**: Quản trị viên hệ thống cập nhật secret trong cấu hình môi trường triển khai của Supabase Edge Functions. Các tài khoản được tạo sau thời điểm cập nhật mà không điền mật khẩu sẽ nhận giá trị mới. Giá trị mật khẩu tuyệt đối không được ghi vào logs, git, hay trả về client.

## 5. Vòng đời tài khoản & Vô hiệu hóa (Account Lifecycle & Deactivation)

- **Trạng thái hoạt động (`is_active`)**:
  - `is_active = true`: Tài khoản hoạt động bình thường.
  - `is_active = false`: Tài khoản bị vô hiệu hóa.
- **Thực thi qua RLS (Database Enforcement)**:
  - Khi `is_active = false`, RLS trên mọi bảng dữ liệu cá nhân (`tasks`, `categories`, `reminders`, `schedule_blocks`, `task_activities`) lập tức từ chối quyền truy cập (SELECT/INSERT/UPDATE/DELETE) ở request tiếp theo.
  - Người dùng chỉ được phép đọc tối thiểu thông tin hồ sơ của chính mình để hiển thị màn hình thông báo bị vô hiệu hóa; không thể cập nhật dữ liệu.
- **Cơ chế Auth Ban**:
  - Khi vô hiệu hóa qua Edge Function `admin-users`, hàm sẽ cập nhật `profiles.is_active = false` trước, sau đó đặt thời gian Auth ban (`banned_until`) để chặn đăng nhập và refresh session. Không yêu cầu cơ chế revoke session riêng.
  - Khi kích hoạt lại: Edge Function gỡ Auth ban trước, sau đó cập nhật `profiles.is_active = true`.
- **Bảo vệ an toàn**: Admin không được phép tự vô hiệu hóa tài khoản của chính mình (`self-deactivation forbidden`) hoặc vô hiệu hóa tài khoản admin khác trừ khi phạm vi cho phép.

## 6. Bắt buộc đổi mật khẩu lần đầu (Password Change Enforcement)

- **Trạng thái bắt buộc (`must_change_password`)**:
  - Tài khoản mới tạo qua admin provisioning luôn có `must_change_password = true`.
  - Khi cờ này bật, RLS chặn truy cập bảng nghiệp vụ cá nhân, và Web Route Guard chuyển hướng người dùng đến trang `/change-password`.
- **Endpoint hoàn tất mật khẩu (`complete-initial-password`)**:
  - Xác thực caller token, kiểm tra hồ sơ server: phải thoả `is_active = true` và `must_change_password = true`.
  - Kiểm tra tính hợp lệ của mật khẩu mới (tối thiểu 8 ký tự).
  - Cập nhật mật khẩu trong Supabase Auth bằng service client.
  - Cập nhật xóa cờ `must_change_password = false` trên profile.
  - Nếu việc xóa cờ thất bại sau khi đổi mật khẩu Auth, cờ vẫn giữ nguyên `true` để đảm bảo an toàn (fail-closed, retry-safe).

## 7. Địa phương hóa đa ngôn ngữ (Localization - VI/EN)

- **Lưu trữ tùy chọn (`locale`)**: Lưu tại `profiles.locale` với các giá trị hợp lệ `vi` | `en` (mặc định: `vi`).
- **Fallback**: Khi chưa đăng nhập hoặc profile chưa tải, client sử dụng fallback locale `vi`.
- **Đồng bộ**: Người dùng có thể thay đổi ngôn ngữ trong trang Cài đặt; gọi `update_my_profile(..., new_locale)` để lưu trữ bền vững vào database.

## 8. Thực thi trạng thái tài khoản trên Extension

- **Nguyên tắc**: Browser Extension là untrusted client.
- **Kiểm tra trạng thái**: Khi khôi phục session và trong chu kỳ sync, extension kiểm tra cờ `is_active` và `must_change_password` từ profile:
  - Nếu `is_active = false`: Lập tức xóa toàn bộ cache cục bộ, xóa các alarm đã đặt, hủy các notification và đăng xuất tài khoản. Chặn toàn bộ tác vụ quick-add, complete, snooze.
  - Nếu `must_change_password = true`: Chặn toàn bộ thao tác CRUD và yêu cầu người dùng mở Web để đổi mật khẩu lần đầu.

## 9. Giới hạn dữ liệu thống kê Admin (Aggregate Allowlist)

- **Quyền riêng tư dữ liệu (Privacy Boundary)**:
  - Admin Portal xem danh sách người dùng và dashboard chỉ nhận dữ liệu tổng hợp (counts), tuyệt đối KHÔNG nhận chi tiết công việc.
  - Hợp đồng aggregate chỉ bao gồm: `user_id`, `task_count` (tổng số task, bao gồm cả subtasks), `todo_count`, `in_progress_count`, `done_count`.
  - Không bao giờ trả về tiêu đề, mô tả, danh mục, liên kết đính kèm hay hoạt động của task cho admin.

## 10. Admin Bootstrap Script

To initialize or repair the first administrator account in an environment:

- **Script**: `scripts/bootstrap-admin.ts` (`pnpm bootstrap:admin`).
- **Configuration**: Uses `.env.bootstrap` (containing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TABDO_ADMIN_EMAIL`, `TABDO_ADMIN_PASSWORD`).
- **Idempotence**: Finds the configured admin by email. Creates it if missing, or updates its profile to `role = 'admin'` if already present. Multiple runs succeed and output `admin verified`.
- **Security**: Service role keys and passwords are never printed or committed.

## 11. Local Verification Commands

From repository root:

```bash
# 1. Dependency check
pnpm install --frozen-lockfile

# 2. Code quality & types
pnpm lint
pnpm typecheck

# 3. Production build
pnpm build

# 4. Automated unit & component tests
pnpm test

# 5. Integration tests
pnpm test:integration
```
