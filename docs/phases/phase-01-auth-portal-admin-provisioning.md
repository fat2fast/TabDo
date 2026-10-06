# Phase 1 — Authentication, Portal Routing & Admin User Provisioning

**Status:** Completed  
**Depends on:** Phase 0  
**Blocks:** Phase 2+  
**Completed via:** PR #1 (`plans/261005-0925-repository-foundation-auth-provisioning`)

## 1. Goal

Implement controlled access to TabDo with:

- no public registration
- one shared Supabase Auth session
- two login entry points
- role-aware portal routing
- admin-created normal users

The key architectural rule is:

> One identity and one session; the current role determines which portal the user may access.

---

## 2. Authentication behavior

Public routes:

    /login
    /admin/login

There is no:

- `/signup`
- Create Account action
- public sign-up API
- sign-up flow inside the browser extension

---

## 3. `/login` behavior

`/login` is the User Portal entry point.

Form:

- Email
- Password
- Sign In

Flow:

    /login
        ↓
    signInWithPassword()
        ↓
    load session
        ↓
    load profile
        ↓
    user  → /dashboard
    admin → /dashboard

Admin is allowed to use the normal User Portal because admin is also a valid personal TabDo user.

---

## 4. `/admin/login` behavior

`/admin/login` is the Admin Portal entry point.

Flow:

    /admin/login
        ↓
    signInWithPassword()
        ↓
    load session
        ↓
    load profile
        ↓
    role = admin
        → /admin/users

    role = user
        → /dashboard
        → show access-denied message

Do not sign out a normal user merely because they attempted `/admin/login`.

Since the application uses one session, forcing sign-out would also destroy their valid User Portal session.

---

## 5. Shared session model

Use one Supabase web client for both portals.

Do not create separate:

- admin auth token storage
- user auth token storage
- admin Supabase project
- user Supabase project

Expected behavior:

- sign in once
- session survives refresh
- role is loaded after session recovery
- admin can change portal without re-authentication
- logout signs out from both portals

---

## 6. Auth state architecture

Recommended components/hooks:

    AuthProvider
    useAuth()
    useProfile()
    AuthenticatedRoute
    AdminRoute

Suggested auth state:

- `session`
- `user`
- `profile`
- `isAuthLoading`
- `isProfileLoading`
- `signIn`
- `signOut`
- `refreshProfile`

Avoid duplicating session state in Zustand if Supabase/AuthProvider already owns it.

Use Zustand only for app state that benefits from it.

---

## 7. Profile loading

After Supabase returns an authenticated user:

1. Read `profiles` using `auth.uid()`.
2. Resolve:
   - display name
   - role
   - timezone
3. Keep the profile available to layout and route guards.

Do not rely solely on JWT user metadata for authorization decisions if `profiles.role` is the application source of truth.

---

## 8. Route guards

### `AuthenticatedRoute`

Protect personal routes:

    /dashboard
    /tasks
    /tasks/:id
    /calendar
    /summary
    /settings

Rule:

    session exists

Both `user` and `admin` pass.

### `AdminRoute`

Protect:

    /admin/*

Rules:

- no session → `/admin/login`
- session + `profile.role !== 'admin'` → `/dashboard`
- session + admin role → allow

The UI guard improves navigation but is not the security boundary for privileged operations.

---

## 9. Portal layouts

Create two layouts:

### `AppLayout`

Used by personal productivity routes.

Contains:

- primary sidebar
- page header
- user menu
- normal navigation
- optional admin portal switch for admin

### `AdminLayout`

Used by `/admin/*`.

For MVP it can be minimal:

- Admin branding/title
- Users section
- account menu
- "Cổng người dùng" action

Do not build an extensive admin dashboard.

---

## 10. Portal switch behavior

If `profile.role === 'admin'`:

### In User Portal

Account menu shows:

    Quản trị

Click:

    navigate('/admin/users')

### In Admin Portal

Account menu shows:

    Cổng người dùng

Click:

    navigate('/dashboard')

There is no additional login step.

### Normal user

Must not see:

    Quản trị

Even if they manually enter `/admin/users`, `AdminRoute` redirects them.

---

## 11. Admin user creation UI

Route:

    /admin/users

For the MVP the screen only needs a create-user form.

Fields:

- Display name
- Email
- Initial password

Action:

    Create User

Optional UX:

- success toast
- copy email action
- password visibility toggle

Do not implement yet:

- editing users
- deleting users
- disabling users
- changing roles
- assigning permissions
- impersonation
- viewing user personal tasks

---

## 12. `admin-create-user` Edge Function

The browser must never use `auth.admin.createUser()` directly.

Expected server flow:

1. Read Authorization bearer token.
2. Validate the caller's Supabase session.
3. Resolve caller's `profiles` row.
4. Require `role = admin`.
5. Validate request body.
6. Create Auth user with Service Role/Admin API.
7. Create or update `profiles` row.
8. Force role to `user`.
9. Return safe response.

Suggested request:

    {
      "email": "mai@example.com",
      "displayName": "Mai",
      "initialPassword": "..."
    }

Suggested safe response:

    {
      "id": "...",
      "email": "mai@example.com",
      "displayName": "Mai",
      "role": "user"
    }

Never return:

- password
- Service Role information
- access token for the created user

---

## 13. Server-side authorization

The Edge Function must reject:

- unauthenticated caller → 401
- authenticated `user` role → 403
- invalid input → 400
- duplicate email → useful conflict response

Do not trust a browser-supplied role value.

Do not allow a request payload such as:

    role: "admin"

to create another admin during MVP.

The function should set:

    role = user

server-side.

---

## 14. Profile creation strategy

Choose one consistent strategy:

### Option A — Database trigger

When an Auth user is created, create `profiles`.

Then the Edge Function updates:

- display_name
- role = user

### Option B — Explicit Edge Function insert

The Edge Function creates the Auth user and then inserts the profile.

For MVP, either is valid, but avoid having both mechanisms race each other unless the operation is written to be idempotent.

Document the chosen strategy in `docs/auth.md`.

---

## 15. Password behavior

For the initial MVP:

- admin sets an initial password
- user signs in with email/password
- user may change their own password from Settings

Do not implement password-reset email flows unless needed.

If a password reset is later introduced, it becomes a separate feature with its own redirect/security behavior.

---

## 16. Account/security settings

Minimum Settings behavior:

- show email
- show display name
- show role
- show timezone
- change own password
- logout

A normal user cannot edit their role.

Admin cannot edit its role through ordinary client UI.

---

## 17. Extension auth impact

The extension will later reuse TabDo accounts.

For Phase 1, define the rule:

- extension supports existing-user sign in only
- extension never supports public registration
- admin account may use extension as a normal personal user
- extension exposes no admin user-management feature

Actual extension login implementation belongs to Phase 6.

---

## 18. Security tests

At minimum test:

1. Unauthenticated access to `/dashboard` redirects to `/login`.
2. Unauthenticated access to `/admin/users` redirects to `/admin/login`.
3. User login at `/login` → `/dashboard`.
4. Admin login at `/login` → `/dashboard`.
5. Admin login at `/admin/login` → `/admin/users`.
6. User login at `/admin/login` → `/dashboard`, session remains valid.
7. User manually enters `/admin/users` → redirected.
8. User calls `admin-create-user` directly → 403.
9. Admin calls Edge Function → user created.
10. Created account has `role = user`.
11. User cannot update own role to admin.
12. Admin cannot read another user's tasks via normal RLS-protected queries.

---

## 19. Deliverables

- `/login`
- `/admin/login`
- AuthProvider
- profile loading
- `AuthenticatedRoute`
- `AdminRoute`
- AppLayout
- AdminLayout
- portal-switch menu behavior
- `/admin/users`
- functional `admin-create-user` Edge Function
- own-password change
- auth/security tests or documented manual test cases

---

## 20. Definition of Done

Phase 1 is done when:

- public registration does not exist
- bootstrap admin can sign in
- admin can enter either portal
- admin switches portals without signing in again
- normal user can sign in through `/login`
- normal user cannot use `/admin/*`
- admin can create a normal user
- normal user cannot create users
- Service Role is never present in client code
- admin role does not bypass personal-data RLS
- logout clears the shared session
- refresh restores valid auth state
