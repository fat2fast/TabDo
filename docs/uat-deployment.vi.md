# Hướng dẫn Triển khai UAT (UAT Deployment Runbook)

_([English version](uat-deployment.md))_

Tài liệu hướng dẫn này (runbook) bao gồm môi trường UAT (User Acceptance Testing) cô lập của TabDo. Hiện tại kho lưu trữ chưa có môi trường Production. Chỉ có các lần push lên nhánh `uat` mới được triển khai lên cloud; việc triển khai production, bản xem trước pull request (PR previews), và các nhánh Supabase preview nằm ngoài phạm vi này.

## Cấu trúc luồng triển khai (Topology)

```text
Phát triển local → main (mã nguồn mới nhất) → merge đã qua review vào uat → UAT Supabase → UAT Vercel
```

Supabase là nguồn chân lý (source of truth) của môi trường UAT. GitHub Actions sẽ thực thi migrations, deploy các Supabase Edge Functions (`admin-create-user`, `admin-users`, `complete-initial-password`), sau đó build và deploy Web SPA. Cần phải tắt tính năng tự động deploy qua Git của Vercel đối với dự án UAT để tránh việc triển khai đi tắt, phá vỡ thứ tự này.

## Điều kiện tiên quyết (Prerequisites)

- Một dự án Supabase Cloud UAT chuyên dụng và một dự án Vercel UAT chuyên dụng. Không tái sử dụng tài nguyên Production hoặc sao chép dữ liệu cá nhân từ Production vào UAT.
- Một hostname UAT ổn định, chẳng hạn như domain mặc định của dự án Vercel hoặc custom domain riêng.
- Một GitHub Environment có tên chính xác là `uat`. Lưu trữ các thông tin xác thực triển khai dưới dạng environment secrets, không dùng repository secrets:
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_UAT_PROJECT_REF`
  - `SUPABASE_UAT_DB_PASSWORD`
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`
- Giới hạn phạm vi (scope) của Supabase access token vào riêng dự án UAT nếu có thể, và Vercel token vào team/project UAT. Tuyệt đối không thêm `SUPABASE_SECRET_KEY` hoặc `SUPABASE_SERVICE_ROLE_KEY` vào GitHub hoặc Vercel.
- Cấu hình dự án Vercel UAT với Root Directory là `apps/web`, Build Command là `pnpm build` (package này thực thi `tsc -b && vite build`), và Output Directory là `dist`. Chỉ thiết lập các biến môi trường client công khai tại đây: `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` (hoặc fallback tương thích ngược `VITE_SUPABASE_ANON_KEY`). Tắt tính năng tự động deploy qua Git; GitHub Actions là đường dẫn triển khai duy nhất.
- Trong Supabase UAT Dashboard → Authentication → URL Configuration, đặt Site URL thành hostname UAT ổn định và chỉ thêm các URL chuyển hướng (redirect URLs) chính xác được ứng dụng Web sử dụng. Giữ các URL local trong `supabase/config.toml` phục vụ phát triển cục bộ.
- Tạo và bảo vệ (protect) nhánh `uat` từ một commit đã được review trên nhánh `main`. Merge các cập nhật từ `main` thông qua quy trình review và kiểm tra CI của repository.

## Quy trình phát hành (Release procedure)

1. Phát triển và kiểm thử các thay đổi ở môi trường local. Các thay đổi về database schema phải được thể hiện bằng một file tuần tự mới trong thư mục `supabase/migrations/`; không chỉnh sửa các migration đã được áp dụng lên database từ xa.
2. Merge thay đổi vào nhánh `main` sau khi đã hoàn thành review và vượt qua CI.
3. Tạo và merge bản cập nhật đã được review từ `main` vào `uat`. Khi push vào `uat`, workflow `.github/workflows/deploy-uat.yml` sẽ được kích hoạt; nếu kích hoạt thủ công (manual dispatch), cũng phải chọn nhánh `uat`.
4. Workflow sẽ chạy `pnpm install --frozen-lockfile`, lint, typecheck, tests, và build trước khi cấp quyền truy cập các deployment credentials.
5. Deploy job liên kết với dự án Supabase thông qua `SUPABASE_UAT_PROJECT_REF`, in ra lịch sử migration, áp dụng các migration đang chờ xử lý bằng `supabase db push`, và deploy các Edge Functions (`admin-create-user`, `admin-users`, `complete-initial-password`). Job này không seed database và không sửa đổi lịch sử migration (`migration repair`).
6. Tiếp theo, job lấy cấu hình môi trường production của dự án Vercel UAT, build dự án được cấu hình với Root Directory `apps/web`, và deploy artifact đã build sẵn dưới dạng một bản production deployment cho dự án Vercel UAT độc lập. Giá trị của các biến Supabase công khai được lấy từ cấu hình của chính dự án Vercel đó.
7. Xem lại tóm tắt workflow để kiểm tra commit, deployment URL, và kết quả các bước thực hiện. Truy cập `/login` cùng một liên kết được bảo vệ như `/tasks`; chỉ đăng nhập bằng tài khoản test UAT và xác nhận rằng các network request từ trình duyệt sử dụng đúng hostname của Supabase UAT.

Job kiểm tra (validation job) sử dụng các placeholder `VITE_` vô hại để việc tạo extension manifest và build không cần đến thông tin xác thực UAT. Các giá trị này không phải là deployment secrets và không được upload dưới dạng artifact.

## Xử lý sự cố và Khôi phục (Recovery and rollback)

- Nếu bước validation thất bại, quá trình triển khai UAT sẽ không chạy. Hãy sửa lỗi trên nhánh `main`, merge thay đổi đã qua review vào nhánh `uat`, và để workflow chạy lại.
- Nếu một migration thất bại hoặc lịch sử migration không khớp với repository, hãy dừng đợt phát hành ngay lập tức. Chạy lệnh `supabase migration list --linked` đối chiếu với dự án UAT và đồng bộ lịch sử bằng một thay đổi cơ sở dữ liệu đã qua review. Không bao giờ chạy `supabase migration repair` tự động hoặc chạy chỉ để che giấu sự bất đồng bộ chưa rõ nguyên nhân.
- Các database migration chỉ đi theo một chiều (forward-only). Khắc phục thay đổi schema đã áp dụng bằng một migration bù (compensating migration) đã qua review; không chỉnh sửa hoặc xóa migration đã được áp dụng trước đó.
- Để rollback Web UI, hãy redeploy bản deployment trạng thái Ready trước đó từ dự án Vercel UAT. Việc này không hoàn tác database schema. Trước khi rollback, hãy xác nhận rằng phiên bản Web cũ vẫn tương thích với schema hiện tại.
- Nếu dự án UAT bị liên kết sai, hãy dừng workflow và kiểm tra lại project ref trong GitHub Environment cùng dự án trên Supabase Dashboard trước khi thử lại bất kỳ thao tác nào. Tuyệt đối không sử dụng `supabase db reset --linked` để khôi phục.

## Tài liệu tham khảo chính thức (Official references)

- [Supabase: Quản lý môi trường](https://supabase.com/docs/guides/deployment/managing-environments)
- [Supabase: Database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase: Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Vercel: Triển khai dự án GitHub](https://vercel.com/docs/git/vercel-for-github)
- [TabDo kiến trúc và ranh giới bảo mật](architecture.md)
