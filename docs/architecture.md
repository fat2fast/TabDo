# TabDo — System Architecture

## 1. Purpose

This document describes the **high-level technical architecture** of TabDo MVP.

It focuses on:

- System boundaries
- Main applications and services
- Technology choices
- Authentication and authorization model
- Data ownership
- Deployment model
- Integration between Web, Extension, and Supabase

Detailed business rules, feature behavior, UI flows, and phase-specific implementation details belong in:

- `docs/mvp-roadmap.md`
- `docs/phases/*`

---

# 2. System Context

TabDo consists of two client applications:

1. Web Application
2. Browser Extension

Both clients use Supabase as the backend platform.

The Web Application is deployed on Vercel.

High-level architecture:

    ┌───────────────────────┐
    │     Web Application   │
    │                       │
    │ React + Vite          │
    │ React Router          │
    │ TanStack Query        │
    └───────────┬───────────┘
                │
                │ supabase-js
                │
                ▼
    ┌───────────────────────┐
    │       Supabase        │
    │                       │
    │ Auth                  │
    │ PostgreSQL            │
    │ Row Level Security    │
    │ Edge Functions        │
    └───────────▲───────────┘
                │
                │ supabase-js
                │
    ┌───────────┴───────────┐
    │   Browser Extension   │
    │                       │
    │ WXT + React           │
    │ Manifest V3           │
    │ chrome.storage        │
    │ chrome.alarms         │
    │ chrome.notifications  │
    └───────────────────────┘

    Web hosting:
    Vercel

---

# 3. Technology Stack

## Web

- React
- Vite
- TypeScript
- React Router
- TanStack Query
- Zustand
- Custom CSS & accessible UI components

## Backend

- Supabase Auth
- PostgreSQL
- Row Level Security
- Supabase Edge Functions
- Supabase Realtime when needed

## Browser Extension

- WXT
- React
- TypeScript
- Chrome Manifest V3

## Hosting

- Vercel

## Repository

- pnpm workspace
- Monorepo

---

# 4. Repository Structure

Recommended structure:

    TabDo/
    ├── apps/
    │   ├── web/
    │   └── extension/
    │
    ├── packages/
    │   ├── supabase/
    │   ├── types/
    │   ├── ui/
    │   └── utils/
    │
    ├── scripts/
    │
    ├── supabase/
    │   ├── functions/
    │   └── migrations/
    │
    ├── docs/
    │
    ├── package.json
    ├── pnpm-lock.yaml
    └── pnpm-workspace.yaml

---

# 5. Application Responsibilities

## 5.1 Web Application

The Web Application is the primary TabDo client.

Responsibilities:

- Authentication UI
- User Portal
- Admin Portal
- Task management
- Calendar
- Dashboard
- Summary
- Settings

The Web Application communicates directly with Supabase using the client-safe anon key.

Privileged Supabase credentials must never be included in the web bundle.

---

## 5.2 Browser Extension

The Browser Extension is a lightweight companion client.

Responsibilities:

- User authentication
- Task quick access
- Reminder synchronization
- Local alarm scheduling
- Browser notifications
- Quick task actions

The extension communicates directly with Supabase using the same public client API (`SUPABASE_URL` and `SUPABASE_ANON_KEY`) and relies on owner RLS for data protection. It requests only `storage`, `alarms`, and `notifications` permissions, along with one exact origin derived from `VITE_SUPABASE_URL` in `host_permissions` (no wildcards, no `activeTab`).

Privileged administrative operations are not performed inside the extension.

---

## 5.3 Supabase

Supabase is the backend platform and source of truth.

Responsibilities:

- User authentication
- Persistent application data
- Data authorization through RLS
- Privileged server-side operations through Edge Functions

Supabase replaces the need for a dedicated backend server during the MVP stage.

---

# 6. Authentication Architecture

TabDo uses Supabase Auth.

The Web Application uses a **single authenticated session**.

There are two login entry points:

    /login
    /admin/login

Both use the same Supabase Auth session.

Role information is stored in the application profile.

Supported roles:

    admin
    user

The role determines access to application areas, not separate authentication systems.

---

# 7. Authorization Model

Authorization is implemented at two levels.

## Client Route Authorization

The Web Application uses route guards to control navigation.

Examples:

    AuthenticatedRoute
    AdminRoute

This controls UI access only.

## Database Authorization

Supabase Row Level Security is the actual data-access boundary.

User-owned records are protected using:

    auth.uid() = user_id

In addition, access to personal records requires an active and non-forced account:

    is_active = true AND must_change_password = false

When an account is deactivated (`is_active = false`), RLS immediately blocks data queries and mutations on subsequent requests. Concurrently, an Auth ban prevents session refresh.

When an account requires password change (`must_change_password = true`), RLS blocks personal records and the client redirects to `/change-password`. Initial password change must be performed through the trusted `complete-initial-password` Edge Function.

Admin role does not automatically bypass personal-data RLS. Reporting aggregates return counts only (`user_id, task_count, todo_count, in_progress_count, done_count`) and never expose task details.

Privileged administrative operations are handled separately through trusted server-side logic (Edge Functions).

---

# 8. Admin Provisioning & Edge Functions

The initial admin is created through a trusted bootstrap process.

Recommended component:

    scripts/bootstrap-admin.ts

The bootstrap process may use:

    SUPABASE_SERVICE_ROLE_KEY

This credential must never be exposed to clients.

Administrative user creation and lifecycle management are performed through:

    Supabase Edge Functions:
        admin-create-user
        admin-users
        complete-initial-password

The Edge Functions:

- Validate the current authenticated user's token
- Verify active admin role via caller-scoped client before using service client
- Resolve optional initial password from server deployment secret (`TABDO_DEFAULT_USER_PASSWORD`)
- Enforce `must_change_password = true` on provisioned accounts
- Execute fail-closed lifecycle transitions (profile deactivated before Auth ban; Auth unbanned before profile activated)
- Return safe aggregate counts without exposing task details


---

# 9. Data Architecture

Core application tables:

    profiles
    categories
    tasks
    reminders
    schedule_blocks
    task_activities

High-level relationship:

    auth.users
        │
        └── profiles
              │
              ├── categories
              ├── tasks
              │    ├── reminders
              │    └── task_activities
              └── schedule_blocks

Subtasks are represented through a self-reference on `tasks`.

---

# 10. Data Ownership

Most application data is personal and user-owned.

Tables containing personal data use a `user_id` ownership column.

Examples:

    tasks.user_id
    categories.user_id
    reminders.user_id
    schedule_blocks.user_id
    task_activities.user_id

RLS policies restrict access to the authenticated owner.

This ownership model is intentionally simple for the MVP and can later be extended with workspace/team ownership if collaboration is introduced.

---

# 11. Shared Packages

## `packages/types`

Shared domain types used by Web and Extension.

Examples:

- UserProfile
- Task
- Reminder
- ScheduleBlock

## `packages/utils`

Pure reusable utilities.

Examples:

- Date helpers
- Timezone helpers
- Reminder helpers
- Validation helpers

## `packages/supabase`

Shared Supabase client construction and common client-safe helpers.

## `packages/ui`

Reusable UI primitives shared across clients when practical.

---

# 12. Web State Architecture

## Server State

Use TanStack Query for remote data:

- Tasks
- Categories
- Reminders
- Schedule blocks
- Profile
- Dashboard data
- Summary data

## Client State

Use Zustand only for local UI state where needed.

Examples:

- Theme
- Sidebar state
- Temporary UI preferences

Do not duplicate server data unnecessarily into client state stores.

---

# 13. Reminder Architecture

Reminder data is stored in Supabase.

The Browser Extension is responsible for local reminder execution.

Architecture:

    Supabase reminders (authoritative)
        ↓
    Extension synchronization (startup, install, popup mutation, 15m periodic)
        ↓
    chrome.storage.local (session, per-user cache, metadata)
        ↓
    chrome.alarms (reconciled reminder:<id> alarms)
        ↓
    chrome.notifications (Done, Snooze 15m, body click)
        ↓
    remote mutation + reconciliation

Reconciliation invariants:
- Alarms are converged with the 7-day upcoming reminder projection.
- Unchanged alarms remain untouched.
- Changed alarm times clear the existing alarm and schedule a new alarm at the updated effective time.
- Reminders that are completed, dismissed, or omitted remotely are cleared from local alarms.
- Reserved periodic sync alarm (`tabdo:sync:periodic`) runs on a 15-minute interval and is never altered by reminder reconciliation.
- Notification body click deep-links to `/tasks/today?taskId=<id>` in the Web app and opens the task drawer.
- Notification Done and Snooze 15m actions perform remote mutations first; local alarms and cache are updated/reconciled only upon remote success.
- Notification close is a no-op that preserves remote reminder state.

---

# 14. Extension Storage

The extension uses:

    chrome.storage.local

For:

- Auth session persistence via Supabase storage adapter (`tabdo:auth:session`, `autoRefreshToken: false`)
- Per-user reminder and Today cache (`tabdo:reminders:v1:<userId>`)
- Local synchronization metadata (`lastSuccessfulSyncAt`, `lastSyncError`, `isStale`)
- Notification context mapping (`tabdo:notifications`)
- Active user tracking (`tabdo:auth:active_user_id`)

The extension treats Supabase as the remote source of truth. Upon sign-out or session invalidation, all per-user cache, active alarms, and notification contexts are purged.

---

# 15. Time Handling

Database timestamps use:

    timestamptz

User timezone is stored in:

    profiles.timezone

Default timezone:

    Asia/Ho_Chi_Minh

Clients are responsible for converting between:

- Local display time
- Absolute database timestamps

Timezone logic should be centralized in shared utilities.

---

# 16. Vercel Deployment

Vercel is used to host the Web Application.

Responsibilities:

- Build React/Vite application
- Serve static assets
- CDN delivery
- SPA route handling

Core backend logic should not depend on Vercel-specific services.

This allows the frontend hosting platform to be replaced later without redesigning the backend.

---

# 17. SPA Routing

Because the Web Application uses React Router, direct navigation to application routes must resolve to `index.html`.

Examples:

    /login
    /admin/login
    /dashboard
    /tasks
    /calendar
    /summary
    /settings
    /admin/users

Vercel should be configured with SPA rewrites accordingly.

---

# 18. Supabase Edge Functions

MVP required Edge Function:

    admin-create-user

Edge Functions should only be introduced where trusted server-side execution is required.

Normal user-owned CRUD should use direct Supabase queries protected by RLS.

---

# 19. Security Boundaries

Client applications are considered untrusted.

Client-safe:

    SUPABASE_URL
    SUPABASE_ANON_KEY

Trusted only:

    SUPABASE_SERVICE_ROLE_KEY

The Service Role key may only exist in:

- Trusted bootstrap scripts
- Supabase Edge Functions
- Secure deployment environments

It must never appear in:

- Web source
- Extension source
- `VITE_*`
- Public repository

---

# 20. Realtime Strategy

Supabase Realtime is optional for the MVP.

Use it only when a feature materially benefits from immediate synchronization.

The initial architecture should work correctly without requiring permanent realtime subscriptions.

---

# 21. CI/CD

Recommended flow:

    Developer
        ↓
    GitHub
        ↓
    GitHub Actions
        ↓
    Typecheck / Lint / Build
        ↓
    Vercel Deployment

Database changes are managed through Supabase migrations.

Edge Functions are deployed separately to Supabase.

---

# 22. Database Migration Strategy

All schema changes should be versioned through:

    supabase/migrations/

Example:

    0001_init.sql
    0002_auth_roles.sql
    0003_constraints.sql

Applied production migrations should not be rewritten casually.

New schema changes should use new forward migrations.

---

# 23. Scalability Direction

The MVP intentionally avoids infrastructure that is not currently required.

Not required initially:

- Dedicated Node backend
- Redis
- Message queue
- Kafka
- Kubernetes
- Microservices

If future usage requires them, these components can be introduced behind the existing Supabase/client boundaries.

---

# 24. Future Architecture Extension

Future collaboration features may introduce:

    workspaces
    workspace_members
    projects
    task_assignees

The current user-owned data model remains the MVP foundation.

Possible future external integrations:

- Google Calendar
- Google Tasks
- Gmail
- Slack
- Microsoft 365

These should be implemented through isolated integration modules rather than mixed directly into core task logic.

---

# 25. Architectural Decisions

## ADR-001 — Supabase as MVP Backend

Use Supabase for:

- Authentication
- PostgreSQL
- RLS
- Edge Functions

Reason:

- Low infrastructure overhead
- Fast MVP development
- PostgreSQL foundation
- No dedicated backend server required

## ADR-002 — Vercel as Frontend Hosting

Use Vercel for the React/Vite frontend.

Reason:

- Simple deployment
- CDN
- Easy Git integration

Backend architecture remains independent from Vercel.

## ADR-003 — Monorepo

Use pnpm workspace.

Reason:

- Web and Extension share types and utilities
- Central dependency management
- Consistent tooling

## ADR-004 — Single Web Auth Session

Use one Supabase Auth session for both User Portal and Admin Portal.

Reason:

- Simpler authentication model
- Admin can switch portals without re-authentication

## ADR-005 — RLS as Data Security Boundary

Personal application data is protected through Supabase RLS.

Reason:

- Clients access Supabase directly
- Authorization must be enforced at the database layer

## ADR-006 — Extension Executes Local Reminders

Use browser alarms and notifications.

Reason:

- No continuously running reminder server required for MVP
- Lower infrastructure complexity and cost

---

# 26. Architecture Summary

TabDo MVP uses a simple serverless architecture:

    Web Application
        +
    Browser Extension
        ↓
    Supabase
        ↓
    PostgreSQL + Auth + RLS + Edge Functions

The Web Application is hosted on Vercel.

The architecture intentionally keeps:

- Authentication centralized
- Data ownership explicit
- Privileged operations server-side
- Personal data protected by RLS
- Web hosting replaceable
- Extension responsibilities narrow

Detailed product behavior and implementation steps are documented separately in the MVP roadmap and phase documents.
