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
- **Authorization**: The function verifies that the caller's profile role is `'admin'`. Non-admins receive `403 Forbidden`, unauthenticated callers receive `401 Unauthorized`.
- **Validation**: Strict payload allowlist (`email`, `displayName`, `initialPassword`). Password must be at least 8 characters. Unpermitted fields (such as `role`) cause `400 Bad Request`.
- **Creation**: The function uses server-side service-role access to provision the Auth account, verifies the trigger created a profile, and explicitly guarantees the new profile role is `'user'`.
- **Response**: Returns non-sensitive user identity (`id`, `email`, `displayName`, `role: 'user'`). Passwords and tokens are never returned or stored in memory.

## 4. Admin Bootstrap Script

To initialize or repair the first administrator account in an environment:

- **Script**: `scripts/bootstrap-admin.ts` (`pnpm bootstrap:admin`).
- **Configuration**: Uses `.env.bootstrap` (containing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TABDO_ADMIN_EMAIL`, `TABDO_ADMIN_PASSWORD`).
- **Idempotence**: Finds the configured admin by email. Creates it if missing, or updates its profile to `role = 'admin'` if already present. Multiple runs succeed and output `admin verified`.
- **Security**: Service role keys and passwords are never printed or committed.

## 5. Local Verification Commands

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
