# TabDo — MVP Phase Documents

This directory expands `docs/mvp-roadmap.md` into implementation-level phase documents.

## Phase order

1. [Phase 0 — Repository Foundation & Project Init](./phase-00-repository-foundation-and-init.md)
2. [Phase 1 — Authentication, Portal Routing & Admin User Provisioning](./phase-01-auth-portal-admin-provisioning.md)
3. [Phase 2 — Core Task Management](./phase-02-core-task-management.md)
4. [Phase 3 — Smart Task Views & Organization](./phase-03-smart-task-views-and-organization.md)
5. [Phase 4 — Scheduling & Calendar](./phase-04-scheduling-and-calendar.md)
6. [Phase 5 — Reminder Engine](./phase-05-reminder-engine.md)
7. [Phase 6 — Browser Extension](./phase-06-browser-extension.md)
8. [Phase 7 — Recurring Tasks](./phase-07-recurring-tasks.md)
9. [Phase 8 — Dashboard](./phase-08-dashboard.md)
10. [Phase 9 — Daily & Weekly Summary](./phase-09-daily-weekly-summary.md)
11. [Phase 10 — MVP Hardening & Release Verification](./phase-10-hardening-and-release.md)

## Product constraints shared by all phases

- No public registration.
- One shared Supabase Auth session for the web application.
- `/login` is the User Portal login entry.
- `/admin/login` is the Admin Portal login entry.
- `admin` can use both User Portal and Admin Portal.
- `user` can use only User Portal.
- Admin's only elevated MVP capability is creating normal users.
- Admin must not automatically gain access to another user's tasks, reminders, schedules, or summaries.
- Vercel hosts the web frontend.
- Supabase provides Auth, PostgreSQL, RLS, and Edge Functions.
- Browser extension uses WXT + React + Manifest V3.
- Personal task data remains user-owned and isolated by RLS.

## Definition of the core product loop

Capture → Organize → Schedule → Remind → Complete → Review

The implementation should prioritize this loop before visual polish or advanced analytics.
