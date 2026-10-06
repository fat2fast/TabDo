# TabDo — MVP Implementation Roadmap

## 1. Purpose

TabDo MVP is a personal productivity application focused on:

- Personal task management
- Scheduling and time planning
- Reminders
- Browser extension notifications
- Dashboard
- Daily and weekly summaries

The first MVP is intentionally focused on individual usage.

User interaction and collaboration are not part of the MVP.

The following features are **not part of the MVP**:

- Public user registration
- Team workspace
- Task assignment between users
- Comments between users
- Shared projects
- Shared tasks
- Team permissions beyond the minimal admin role
- Organization management
- Team analytics
- Chat
- Complex workflow automation
- Mobile application

These may be introduced after the personal productivity workflow has been validated.

---

## 1.1 Phase Implementation Status

Current progress across the 11 MVP implementation phases:

| Phase | Name | Status | Evidence / Artifacts |
|---|---|---|---|
| [Phase 0](#phase-0--repository-foundation--project-init) | Repository Foundation & Project Init | **Completed** | PR #1 (`plans/261005-0925-...`), migrations `0001` & `0002`, `@tabdo/*` monorepo |
| [Phase 1](#phase-1--authentication-portal-routing--admin-user-provisioning) | Authentication, Portal Routing & Admin User Provisioning | **Completed** | PR #1 (`plans/261005-0925-...`), `/login` & `/admin/login`, `admin-create-user` |
| [Phase 2](#phase-2--core-task-management) | Core Task Management | **Completed** | PR #2 (`plans/261005-1305-...`), migration `0003`, Task CRUD, checklist subtasks |
| [Phase 3](#phase-3--smart-task-views--organization) | Smart Task Views & Organization | **Completed** | PR #2 (`plans/261005-1305-...`), `Inbox`, `Today`, `Upcoming`, filters, categories |
| [Phase 4](#phase-4--scheduling--calendar) | Scheduling & Calendar | **Completed** | PR #3 (`plans/261006-0832-...`), migration `0004`, FullCalendar day/week, schedule blocks |
| [Phase 5](#phase-5--reminder-engine) | Reminder Engine | **Completed** | PR #3 (`plans/261006-0832-...`), migration `0005`, absolute/relative triggers, drawer UI |
| [Phase 6](#phase-6--browser-extension) | Browser Extension | **Planned (Next up)** | WXT MV3 popup, Today sync via `chrome.storage.local`, alarm runtime |
| [Phase 7](#phase-7--recurring-tasks) | Recurring Tasks | **Planned** | Recurrence rules, auto-regeneration |
| [Phase 8](#phase-8--dashboard) | Dashboard | **Planned** | Daily agenda, overdue alerts, productivity metrics |
| [Phase 9](#phase-9--daily--weekly-summary) | Daily & Weekly Summary | **Planned** | Completed vs rolled over review |
| [Phase 10](#phase-10--mvp-hardening--release-verification) | MVP Hardening & Release Verification | **Planned** | Cross-client smoke tests, performance, security gates |

---

# 2. User Model

TabDo MVP has two roles:

- `admin`
- `user`

## Admin

The admin account is created during environment/bootstrap setup.

For the MVP, the admin has one elevated administrative capability:

- Create normal users

The admin is still a normal TabDo user for personal productivity features and can use:

- Dashboard
- Tasks
- Calendar
- Reminders
- Summary
- Browser Extension

The admin does **not** automatically gain access to another user's personal data.

## User

A normal user:

- Cannot register themselves
- Can sign in only after being created by the admin
- Can manage only their own personal tasks and productivity data
- Cannot create other users
- Cannot access the Admin Portal
- Cannot access other users' data

---

# 3. Authentication & Portal Model

TabDo uses a **single Supabase Auth session**.

There is no separate admin session and user session.

Both login entry points authenticate against the same Supabase project and the same browser session storage.

Routes:

    /login
    /admin/login

Behavior:

    /login
        ↓
    signInWithPassword()
        ↓
    user  → /dashboard
    admin → /dashboard

    /admin/login
        ↓
    signInWithPassword()
        ↓
    admin → /admin/users
    user  → /dashboard + access denied message

There is no public Sign Up flow.

The application supports:

- Sign in
- Sign out
- Session restore
- Change own password
- Role-based route protection

Because there is only one session:

- Admin can switch from Admin Portal to User Portal without signing in again.
- Admin can switch from User Portal to Admin Portal without signing in again.
- Logging out signs the account out of both portals.

---

# 4. Portal Switching

## User Portal

Routes:

    /dashboard
    /tasks
    /tasks/:id
    /calendar
    /summary
    /settings

Both `user` and `admin` roles may access the User Portal.

## Admin Portal

Current MVP route:

    /admin/users

Only `admin` may access the Admin Portal.

## Account Menu Behavior

When an admin is inside the User Portal, show:

    Quản trị

Clicking it navigates to:

    /admin/users

When an admin is inside the Admin Portal, show:

    Cổng người dùng

Clicking it navigates to:

    /dashboard

Normal users never see:

    Quản trị

No re-authentication is required when switching portals.

---

# 5. Admin Bootstrap & User Creation

The initial admin must never be created from browser-side code.

Trusted environment variables may be used by the bootstrap process:

    SUPABASE_URL=
    SUPABASE_SERVICE_ROLE_KEY=
    TABDO_ADMIN_EMAIL=
    TABDO_ADMIN_PASSWORD=

Never expose privileged credentials through:

    VITE_*

Never bundle them into:

- React web application
- Browser extension
- Public GitHub repository

Because TabDo uses a Vite static frontend, the default admin should be created with a trusted bootstrap mechanism such as:

    scripts/bootstrap-admin.ts

The bootstrap script must be idempotent:

- If the admin does not exist, create it.
- If the admin already exists, do nothing.
- Ensure the matching profile has `role = admin`.
- Never create duplicate admin users.

## Admin-created normal users

Creating Supabase Auth users is a privileged operation.

The browser must not receive the Supabase Service Role key.

Use a Supabase Edge Function:

    admin-create-user

Flow:

    Admin Web UI
        ↓
    Current Supabase session JWT
        ↓
    admin-create-user Edge Function
        ↓
    Resolve requester identity
        ↓
    Verify profiles.role = admin
        ↓
    Supabase Admin API
        ↓
    Create auth user
        ↓
    Create/update profile with role = user

For the MVP, admin user management only needs:

- Email
- Display name
- Initial password
- Create User button

No user editing, deletion, suspension, role changes, or password reset by admin are required yet.

---

# 6. MVP Core Loop

The main TabDo workflow is:

    Capture
       ↓
    Organize
       ↓
    Schedule
       ↓
    Remind
       ↓
    Complete
       ↓
    Review

The MVP should make this flow simple and reliable.

---

# 7. Technology Stack

## Web

- React
- Vite
- TypeScript
- React Router
- TanStack Query
- Zustand
- Tailwind CSS
- shadcn/ui

## Backend

- Supabase
  - PostgreSQL
  - Authentication
  - Row Level Security
  - Edge Functions
  - Realtime when needed

## Browser Extension

- WXT
- React
- TypeScript
- Chrome Manifest V3
- chrome.storage
- chrome.alarms
- chrome.notifications

## Hosting

- Vercel

## Repository

- pnpm workspace
- Monorepo

Target structure:

    TabDo/
    ├── apps/
    │   ├── web/
    │   └── extension/
    ├── packages/
    │   ├── types/
    │   ├── utils/
    │   ├── supabase/
    │   └── ui/
    ├── scripts/
    │   └── bootstrap-admin.ts
    ├── supabase/
    │   ├── functions/
    │   │   └── admin-create-user/
    │   ├── migrations/
    │   └── seed.sql
    ├── docs/
    ├── package.json
    ├── pnpm-workspace.yaml
    └── README.md

---

# Phase 0 — Repository Foundation & Project Init

## Goal

Prepare a stable development foundation before implementing product features.

At the end of this phase:

- The monorepo can be installed successfully.
- Web can run locally.
- Extension can run locally.
- Supabase migrations can be applied.
- The default admin can be bootstrapped securely.
- One shared Supabase session can serve both User Portal and Admin Portal.
- CI can verify the repository.
- Package naming and configuration use the TabDo identity.

## 0.1 Rename project packages

Replace the temporary legacy naming.

Examples:

- `legacy-starter` → `tabdo`
- `@legacy/web` → `@tabdo/web`
- `@legacy/extension` → `@tabdo/extension`
- `@legacy/types` → `@tabdo/types`
- `@legacy/utils` → `@tabdo/utils`
- `@legacy/supabase` → `@tabdo/supabase`
- `@legacy/ui` → `@tabdo/ui`

Update:

- Root package.json
- Workspace dependencies
- Import paths
- README
- App names

## 0.2 Define Node and pnpm versions

Target:

- Node >= 22.12
- pnpm >= 10

Add Node engine to root package.json:

    "engines": {
      "node": ">=22.12.0"
    }

Add `.nvmrc`:

    22

## 0.3 Pin dependency versions

Do not use `latest` for project dependencies.

Pin compatible versions for:

- React
- React DOM
- Vite
- TypeScript
- Supabase JS
- WXT
- React Router
- TanStack Query
- Zustand

The lockfile must be committed.

## 0.4 Fix WXT React configuration

Use the supported WXT React module configuration.

The extension manifest should include the minimum required permissions:

- storage
- alarms
- notifications

Add Supabase host permissions only as required.

## 0.5 Standardize the shared Supabase package

Supabase initialization should be reusable by both:

- Web
- Browser Extension

Target package:

    packages/supabase

Responsibilities:

- Supabase client factory
- Shared database types
- Shared auth helpers
- Shared query helpers when appropriate

Avoid duplicating Supabase initialization logic in every application.

## 0.6 Define the role model

Add role support to profiles.

Suggested values:

    admin
    user

The `profiles` table should include:

- id
- display_name
- timezone
- role
- created_at
- updated_at

Default role:

    user

Only the bootstrap process should create the initial admin role.

Normal browser clients must not be able to promote themselves to admin.

## 0.7 Initial database schema

Initial tables:

- profiles
- categories
- tasks
- reminders
- schedule_blocks
- task_activities

Tasks must support:

    parent_id

for subtasks.

Add:

    recurrence_rule

to support recurring tasks later.

## 0.8 Enable Row Level Security

Enable RLS for all user-owned tables.

Normal user data must remain isolated by:

    auth.uid()

Tables:

- profiles
- categories
- tasks
- reminders
- schedule_blocks
- task_activities

Important rule:

The `admin` role does not bypass personal-data RLS.

Admin privileges are limited to user provisioning through the trusted Edge Function.

The admin must not be able to query other users' tasks merely because their profile role is `admin`.

## 0.9 Add basic database indexes

At minimum:

- tasks(user_id, due_at)
- tasks(user_id, status)
- tasks(user_id, category_id)
- reminders(user_id, remind_at)
- schedule_blocks(user_id, start_at)
- task_activities(user_id, created_at)

## 0.10 Prepare environment configuration

Client environment example:

    apps/web/.env.example

with:

    VITE_SUPABASE_URL=
    VITE_SUPABASE_ANON_KEY=

Trusted bootstrap environment example:

    .env.bootstrap.example

with:

    SUPABASE_URL=
    SUPABASE_SERVICE_ROLE_KEY=
    TABDO_ADMIN_EMAIL=
    TABDO_ADMIN_PASSWORD=

Never commit real values.

Never prefix privileged credentials with `VITE_`.

## 0.11 Implement the admin bootstrap script

Create:

    scripts/bootstrap-admin.ts

Responsibilities:

- Read admin credentials from environment
- Connect using the Supabase Admin API
- Check whether the configured admin already exists
- Create the admin if necessary
- Ensure the matching profile has `role = admin`
- Exit safely when the admin already exists

The script must be safe to run multiple times.

Suggested command:

    pnpm bootstrap:admin

## 0.12 Prepare the admin-create-user Edge Function

Create:

    supabase/functions/admin-create-user/

The function should:

1. Require an authenticated Supabase session.
2. Resolve the requester's profile.
3. Verify `role = admin`.
4. Validate the new user's email and initial password.
5. Create the Supabase Auth user using the Admin API.
6. Ensure the new profile has `role = user`.
7. Return only safe user information.
8. Never expose the Service Role key.

No edit/delete/reset-user behavior is required in this phase.

## 0.13 Configure Vercel SPA routing

React Router routes must work after direct browser refresh.

Examples:

- /dashboard
- /tasks
- /calendar
- /summary
- /settings
- /admin/login
- /admin/users

These routes must not return HTTP 404.

## 0.14 Add repository validation scripts

Root scripts should support:

- pnpm dev:web
- pnpm dev:extension
- pnpm build
- pnpm typecheck
- pnpm lint
- pnpm bootstrap:admin

## 0.15 Add GitHub Actions CI

CI should run:

- pnpm install --frozen-lockfile
- pnpm typecheck
- pnpm build

Optional:

- pnpm lint
- pnpm test

The CI workflow must not contain real admin passwords or Supabase Service Role keys.

## Phase 0 Acceptance Criteria

Phase 0 is complete when:

- `pnpm install` succeeds.
- Web development server starts.
- Extension development build starts.
- Production build succeeds.
- Supabase migrations apply successfully.
- RLS is enabled.
- Role model exists.
- Admin bootstrap script is available.
- Bootstrap script is idempotent.
- Admin credentials are not exposed to browser code.
- `admin-create-user` function foundation exists.
- CI passes.
- No package uses the old legacy namespace.
- No production dependency uses `latest`.
- No secret key is committed.
- README identifies the project as TabDo.

---

# Phase 1 — Authentication, Portal Routing & Admin User Provisioning

## Goal

Provide controlled access to TabDo without public registration, using one shared Supabase session and two portal entry points.

At the end of this phase:

- The bootstrap admin can sign in.
- Normal users can sign in.
- There is no public registration.
- `/login` opens the User Portal flow.
- `/admin/login` opens the Admin Portal flow.
- Admin can switch between User Portal and Admin Portal without re-authentication.
- Admin can create normal users.
- Normal users cannot access admin routes.
- Admin role does not grant access to another user's personal productivity data.

## 1.1 Public authentication routes

Create:

    /login
    /admin/login

Neither page contains:

- Sign Up
- Create Account
- Public registration

Both pages use the same Supabase Auth session.

## 1.2 `/login` behavior

`/login` is the normal User Portal entry point.

Flow:

    /login
        ↓
    signInWithPassword()
        ↓
    load profile
        ↓
    user  → /dashboard
    admin → /dashboard

Both roles may use the User Portal.

## 1.3 `/admin/login` behavior

`/admin/login` is the Admin Portal entry point.

Flow:

    /admin/login
        ↓
    signInWithPassword()
        ↓
    load profile
        ↓
    role = admin
        → /admin/users

    role = user
        → /dashboard
        → show "Tài khoản này không có quyền quản trị"

Do not automatically sign out a normal user who tries to use `/admin/login`.

## 1.4 Shared session behavior

Use one Supabase auth client/session for the web application.

Do not create separate storage keys for admin and user sessions in the MVP.

Expected behavior:

- Sign in once.
- Navigate freely between portals according to role.
- Logout clears the single session.
- Session survives refresh.
- Role is reloaded after session restore.

## 1.5 Profile loading

After authentication:

- Load the user's profile.
- Resolve role.
- Resolve timezone.
- Make profile available to route guards and layouts.

Profile fields:

- id
- display_name
- timezone
- role
- created_at
- updated_at

Default timezone:

    Asia/Ho_Chi_Minh

All database timestamps should use:

    timestamptz

## 1.6 Route guards

### AuthenticatedRoute

Protect:

- /dashboard
- /tasks
- /tasks/:id
- /calendar
- /summary
- /settings

Condition:

    valid session exists

Both:

    role = user
    role = admin

are allowed.

### AdminRoute

Protect:

    /admin/*

Condition:

    valid session exists
    AND profile.role = admin

If there is no session:

    redirect → /admin/login

If the session exists but role is not admin:

    redirect → /dashboard

## 1.7 Portal layouts

Create separate layouts:

    AppLayout
    AdminLayout

`AppLayout` is used for personal productivity routes.

`AdminLayout` is used for admin routes.

The authentication identity/session remains shared.

## 1.8 Portal switching

When `profile.role = admin`:

### Inside User Portal

Show account-menu item:

    Quản trị

Action:

    navigate → /admin/users

### Inside Admin Portal

Show account-menu item:

    Cổng người dùng

Action:

    navigate → /dashboard

Do not request another login when switching portals.

For normal users:

- Do not show `Quản trị`.
- Prevent access to `/admin/*`.

## 1.9 Admin Create User

Add:

    /admin/users

For the MVP, the page only needs:

- Email
- Display name
- Initial password
- Create User

The web application calls:

    admin-create-user

The Edge Function must:

1. Require a valid authenticated session.
2. Resolve the requester.
3. Verify `profiles.role = admin`.
4. Validate the new account fields.
5. Create the Supabase Auth user using the Admin API.
6. Ensure the new profile has `role = user`.
7. Return only safe user information.

The browser must never call the Supabase Auth Admin API directly.

The browser must never contain:

    SUPABASE_SERVICE_ROLE_KEY

## 1.10 Newly created user behavior

A newly created account:

- Has `role = user`.
- Can sign in through `/login`.
- May technically authenticate at `/admin/login`, but must be redirected to `/dashboard`.
- Has access only to its own TabDo data.
- Cannot access `/admin/*`.
- Cannot create users.

The user may change their own password from Settings.

## 1.11 User Portal navigation

Normal navigation:

- Dashboard
- Tasks
  - Inbox
  - Today
  - Upcoming
  - Overdue
- Calendar
- Summary
- Settings

For admin only, account menu additionally exposes:

- Quản trị

## Phase 1 Acceptance Criteria

Phase 1 is complete when:

- There is no public registration flow.
- Bootstrap admin can sign in through `/login`.
- Bootstrap admin can sign in through `/admin/login`.
- `/login` sends both admin and user accounts to `/dashboard`.
- `/admin/login` sends admin to `/admin/users`.
- `/admin/login` redirects a normal user to `/dashboard` without destroying the session.
- Session persists after refresh.
- Admin can switch from `/dashboard` to `/admin/users` without logging in again.
- Admin can switch from `/admin/users` to `/dashboard` without logging in again.
- Normal user does not see the admin portal switch.
- Normal user cannot access `/admin/*`.
- Admin can create a normal user.
- Normal user cannot create users.
- Admin cannot use the admin role to read another user's personal task data.
- User can sign out.
- User can change their own password.
- Cross-user personal data access is rejected by RLS.

---

# Phase 2 — Core Task Management

## Goal

Provide the core personal task management experience.

This is the most important functional phase of the MVP.

Both `admin` and `user` accounts use the same personal-task model.

Admin role does not provide extra task permissions.

## Task fields

A task should support:

- id
- user_id
- parent_id
- title
- description
- status
- priority
- category_id
- start_at
- due_at
- completed_at
- source_url
- recurrence_rule
- created_at
- updated_at

## Task Status

Initial statuses:

- todo
- in_progress
- done

Do not store `overdue` as a status.

Overdue is calculated as:

    due_at < current time
    AND status != done

## Priority

Supported values:

- low
- medium
- high

## Task CRUD

Implement:

- Create task
- Read task
- Update task
- Delete task
- Complete task
- Reopen task

## Quick Add

Users should be able to quickly create a task with only a title.

Optional fields:

- deadline
- priority
- category
- reminder

The user should not be forced to complete a large form to capture a task.

## Task Detail

Task detail should support:

- Title
- Description
- Status
- Priority
- Category
- Deadline
- Subtasks
- Source URL
- Reminder

Recommended UX:

    Task drawer

## Subtasks

Use:

    parent_id

to support subtasks.

No separate `subtasks` table is required.

## Categories

Users can create personal categories.

Examples:

- Work
- Personal
- Learning
- Health

Implement:

- Create
- Rename
- Delete

## Phase 2 Acceptance Criteria

- User can create a task.
- User can edit a task.
- User can delete a task.
- User can complete and reopen a task.
- Priority works.
- Categories work.
- Subtasks work.
- Deadline works.
- Task ownership is protected by RLS.
- Admin and normal users have the same personal-task data isolation.
- Task state remains correct after page refresh.

---

# Phase 3 — Smart Task Views & Organization

## Goal

Allow users to understand what needs attention without manually organizing every task.

## Inbox

Inbox contains tasks that were quickly captured and have not yet been fully organized.

Possible rule:

- No due date
- and/or No category

Exact Inbox behavior may be refined during implementation.

## Today

Show tasks relevant to the current day, including:

- Due today
- Scheduled today
- Overdue tasks

## Upcoming

Display future tasks grouped by:

- Tomorrow
- This Week
- Later

## Overdue

Display tasks where:

    due_at < now()
    AND status != done

## Completed

Provide access to recently completed tasks.

Default ordering:

    completed_at DESC

## Filtering

Initial filters:

- Status
- Priority
- Category
- Due date

## Sorting

Initial sorting:

- Due date
- Priority
- Created date
- Updated date

## Search

Basic title search should be available.

Advanced full-text search is not required for MVP.

## Phase 3 Acceptance Criteria

- Inbox works.
- Today works.
- Upcoming works.
- Overdue works.
- Completed view works.
- Filtering works.
- Sorting works.
- Basic search works.

---

# Phase 4 — Scheduling & Calendar

## Goal

Separate when a task is due from when the user plans to work on it.

This distinction is fundamental to TabDo.

## Schedule Block

Use:

    schedule_blocks

Fields:

- id
- user_id
- task_id
- title
- start_at
- end_at
- created_at
- updated_at

A schedule block may reference a task or exist independently.

## Calendar Views

MVP priority:

- Day
- Week

Month view is optional for the first release.

## Schedule Actions

Implement:

- Create schedule block
- Edit schedule block
- Delete schedule block
- Move schedule block
- Resize schedule block

## Task Scheduling

Users should be able to schedule an existing task.

Ideal interaction:

    Task
      ↓
    Drag
      ↓
    Calendar

Drag-and-drop may be implemented after the basic schedule workflow works.

## Phase 4 Acceptance Criteria

- User can create schedule blocks.
- Schedule blocks appear in calendar.
- Schedule block can reference a task.
- Task deadline remains independent from scheduled time.
- Day view works.
- Week view works.
- Scheduling data persists after refresh.

---

# Phase 5 — Reminder Engine

## Goal

Allow users to define reliable reminders for tasks.

Reminder is a core TabDo feature.

## Reminder Model

A task can have multiple reminders.

Do not limit a task to one `reminder_at` field.

Use the dedicated:

    reminders

table.

## Reminder Presets

Initial options:

- At due time
- 5 minutes before
- 15 minutes before
- 30 minutes before
- 1 hour before
- 1 day before
- Custom

## Snooze

Support:

- 15 minutes
- 30 minutes
- 1 hour
- Custom

Optional later:

- Tomorrow morning

## Reminder Status

Suggested values:

- pending
- triggered
- snoozed
- dismissed

## Reminder Synchronization Strategy

Do not query Supabase every minute.

Preferred workflow:

    Load upcoming reminders
        ↓
    Store locally
        ↓
    Schedule browser alarms

Sync when:

- Extension starts
- Popup opens
- Reminder changes
- Task changes
- Periodic background sync

## Phase 5 Acceptance Criteria

- User can create reminders.
- One task can have multiple reminders.
- Reminder can be edited.
- Reminder can be deleted.
- Snooze state is supported.
- Upcoming reminders can be queried efficiently.
- Reminder times work correctly with timezone handling.

---

# Phase 6 — Browser Extension

## Goal

Provide reminders and quick task interaction without requiring the TabDo web application to remain open.

## Extension MVP Views

Only implement:

- Today
- Quick Add
- Settings

Avoid building a miniature full web app inside the extension.

## Extension Authentication

The extension uses existing TabDo accounts.

There is no Sign Up flow in the extension.

The extension must support:

- Sign in
- Sign out
- Session restore

Session storage should use:

    chrome.storage.local

## Today View

Show:

- Completion progress
- Today's tasks
- Deadlines
- Quick complete action

## Quick Add

Allow user to quickly create:

- Task title
- Due date
- Reminder

Optional:

- Attach current URL

## Browser Notification

Notification actions:

- Done
- Snooze
- Open

## Alarm Engine

Use:

- `chrome.alarms`
- `chrome.notifications`

## Local Cache

Use:

    chrome.storage.local

for:

- Session
- Upcoming reminders
- Cached task data
- Last synchronization timestamp

## Reminder Sync

Suggested workflow:

    Extension starts
        ↓
    Load Supabase session
        ↓
    Fetch upcoming reminders
        ↓
    Store local cache
        ↓
    Create chrome alarms

## Quick Capture from Current Page

Optional MVP feature:

- Create task
- Attach `source_url` from current browser tab

## Phase 6 Acceptance Criteria

- Extension installs successfully.
- Existing TabDo user can sign in.
- Extension contains no public registration flow.
- Today tasks appear.
- Quick Add works.
- Upcoming reminders synchronize.
- chrome.alarms are created.
- Notifications are displayed.
- User can complete a task from extension.
- User can snooze a reminder.
- User can open the related task in the web application.

---

# Phase 7 — Recurring Tasks

## Goal

Support common repeating personal tasks.

## Initial Recurrence Options

Support:

- Daily
- Weekdays
- Weekly
- Monthly
- Custom weekdays

## Storage

Use:

    recurrence_rule

Prefer an RRULE-compatible representation.

Examples:

    FREQ=DAILY

    FREQ=WEEKLY;BYDAY=MO,WE,FR

The UI should not expose raw RRULE syntax.

## Recurrence Behavior

When a recurring task is completed:

    Current occurrence
        ↓
    Completed
        ↓
    Next occurrence generated

Avoid modifying historical completed occurrences.

## Phase 7 Acceptance Criteria

- Daily recurrence works.
- Weekly recurrence works.
- Monthly recurrence works.
- Weekday recurrence works.
- Completing an occurrence creates the next occurrence correctly.
- Completed historical tasks remain unchanged.

---

# Phase 8 — Dashboard

## Goal

Provide a simple command center for the user's current workload.

The dashboard should prioritize actionable information over decorative charts.

## Dashboard Sections

Initial dashboard:

- Today overview
- Tasks completed
- Tasks remaining
- Overdue tasks
- Priority tasks
- Today's schedule
- Upcoming deadlines

## Metrics

Initial metrics:

- Total today
- Completed today
- Remaining today
- Overdue
- Completion percentage

No dedicated analytics backend is required yet.

## Phase 8 Acceptance Criteria

- Today task count is correct.
- Completion count is correct.
- Overdue count is correct.
- Priority tasks are visible.
- Today's schedule is visible.
- Dashboard updates after task completion.

---

# Phase 9 — Daily & Weekly Summary

## Goal

Help users review productivity and understand unfinished work.

AI is not required.

## Daily Summary

Show:

- Planned tasks
- Completed tasks
- Pending tasks
- Overdue tasks
- Completion rate

Sections:

- Completed
- Carry over
- Overdue

## Weekly Summary

Show:

- Tasks created
- Tasks completed
- Completion rate
- Overdue count
- Most productive day
- Tasks by category

Optional comparison:

- This week
- Previous week

## Data Source

Prefer existing:

- tasks
- task_activities

Do not create an analytics infrastructure for MVP.

## AI Summary

Not part of MVP.

Potential future feature:

- Weekly AI insight

## Phase 9 Acceptance Criteria

- Daily summary works.
- Weekly summary works.
- Completion rate is correct.
- Overdue metrics are correct.
- Category breakdown is correct.
- Historical completed tasks are represented accurately.

---

# Phase 10 — MVP Hardening & Release Verification

## Goal

Prepare the MVP for actual personal usage and early testers.

No new major product features should be introduced during this phase.

## Authentication Verification

Verify:

- No public registration exists.
- Web uses one shared Supabase session for both portals.
- Portal switching does not require re-authentication.
- Admin bootstrap is idempotent.
- Admin credentials are not present in frontend bundles.
- Service Role key is not present in web or extension code.
- Only admin can call the user-creation function successfully.
- Normal users cannot promote themselves.
- Normal users cannot create users.

## Admin Scope Verification

Verify that the admin's elevated role is limited to:

- Creating normal users

The admin must not receive implicit access to:

- Other users' tasks
- Other users' categories
- Other users' reminders
- Other users' schedule blocks
- Other users' summaries

## Data Integrity

Review relationships between:

- tasks
- categories
- reminders
- schedule_blocks

Ensure a user cannot accidentally reference another user's resources.

Consider stronger composite constraints where necessary.

## Security Review

Verify:

- RLS on every user-owned table
- No Service Role key in client code
- No secrets committed
- Auth session handled correctly
- Cross-user access rejected
- Admin user creation validates server-side role

## Timezone Verification

Test:

- Task deadlines
- Calendar blocks
- Reminder times
- Recurring tasks

using:

- Asia/Ho_Chi_Minh
- At least one other timezone

## Error Handling

Provide user-friendly handling for:

- Network failure
- Supabase unavailable
- Authentication expiry
- Invalid form data
- Failed user creation
- Failed task save
- Failed reminder synchronization

## Loading States

All major screens should handle:

- Loading
- Empty
- Error
- Success

## Empty States

Create useful empty states for:

- Dashboard
- Tasks
- Today
- Upcoming
- Overdue
- Calendar
- Summary
- Admin user management

## Performance

Avoid:

- Loading all tasks on every screen
- Polling Supabase every minute
- Unnecessary realtime subscriptions

Use appropriate database indexes and scoped queries.

## Extension Reliability

Verify:

- Browser restart
- Extension restart
- Expired session
- Task deadline change
- Reminder change
- Reminder deletion
- Snooze
- Task completion

Extension must rebuild alarms correctly when needed.

## CI

Required checks:

- Install
- Typecheck
- Build web
- Build extension
- Lint

Optional:

- Unit tests
- Database tests
- Edge Function tests

## Production Deployment

Deploy:

- Web → Vercel
- Database/Auth → Supabase
- Admin Edge Function → Supabase Edge Functions

Run the trusted admin bootstrap process during environment setup.

Extension MVP may initially be distributed manually for testing before publishing to a browser extension store.

## Release Documentation

Update:

- README.md
- docs/mvp-roadmap.md
- docs/architecture.md
- docs/database.md
- docs/auth.md
- docs/extension.md

Document:

- Environment setup
- Initial admin bootstrap
- Admin user creation
- User sign-in flow
- Secret-management requirements

## Phase 10 Acceptance Criteria

The MVP is ready when:

- Fresh environment can bootstrap the default admin.
- There is no public user registration.
- Admin can sign in through both `/login` and `/admin/login`.
- Admin can switch between User Portal and Admin Portal with the same session.
- Admin can create a normal user.
- Normal user can sign in.
- Normal user cannot create another user.
- Admin cannot read another user's personal productivity data.
- User can create tasks.
- User can organize tasks.
- User can schedule tasks.
- User can create reminders.
- Extension receives reminders.
- Snooze works.
- User can complete tasks.
- Recurring tasks work.
- Dashboard works.
- Daily summary works.
- Weekly summary works.
- Refreshing web routes does not fail.
- RLS prevents cross-user access.
- Production build succeeds.
- CI passes.
- Vercel deployment succeeds.
- Supabase production migration succeeds.
- Supabase Edge Function deployment succeeds.
- Core workflow can be completed without developer intervention.

---

# MVP Completion Definition

The MVP is considered complete when both the provisioning flow and personal-productivity flow work reliably.

Provisioning and portal flow:

    Environment setup
        ↓
    Bootstrap admin
        ↓
    Admin signs in
        ↓
    /login → User Portal
    or
    /admin/login → Admin Portal
        ↓
    Admin switches portals with the same session
        ↓
    Admin creates user
        ↓
    User signs in through /login

Personal productivity flow:

    User signs in
        ↓
    Quickly creates a task
        ↓
    Adds deadline
        ↓
    Adds reminder
        ↓
    Schedules time to work on it
        ↓
    Extension reminds the user
        ↓
    User snoozes or completes it
        ↓
    Dashboard updates
        ↓
    Daily / weekly summary reflects the result

---

# Post-MVP

The following should only be considered after the personal workflow is validated:

- Admin user listing enhancements
- User edit
- User disable/suspend
- User deletion
- Admin password reset for users
- Role management
- Multi-user collaboration
- Shared tasks
- Task assignment
- Workspace
- Projects
- Comments
- Followers
- Shared calendars
- Team roles
- Team dashboard
- Google Calendar integration
- Google Tasks integration
- Email integration
- Mobile/PWA
- AI planning assistant
- AI daily summary
- AI weekly insights
- Natural-language task creation
- Advanced automation

---

# Phase Dependency

    Phase 0 — Repository Foundation + Admin Bootstrap
        ↓
    Phase 1 — Authentication + Portal Routing + Admin User Provisioning
        ↓
    Phase 2 — Core Tasks
        ↓
    Phase 3 — Smart Views
        ↓
    Phase 4 — Calendar / Scheduling
        ↓
    Phase 5 — Reminder Engine
        ↓
    Phase 6 — Browser Extension
        ↓
    Phase 7 — Recurring Tasks
        ↓
    Phase 8 — Dashboard
        ↓
    Phase 9 — Summary
        ↓
    Phase 10 — Hardening & MVP Release

---

# Recommended Implementation Priority

The access chain must work first:

    Bootstrap Admin
        ↓
    Shared Session Auth
        ↓
    User Portal ↔ Admin Portal
        ↓
    Create User
        ↓
    User Sign In

Then prioritize the core TabDo product chain:

    Task
        ↓
    Deadline
        ↓
    Schedule
        ↓
    Reminder
        ↓
    Extension Notification
        ↓
    Complete

Do not spend significant time polishing analytics, charts, admin functionality, or visual details before these chains work reliably.

TabDo should first prove that it helps the user:

> know what to do, decide when to do it, remember to do it, and review what was completed.
