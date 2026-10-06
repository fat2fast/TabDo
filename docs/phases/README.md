# TabDo — MVP Phase Documents

This directory expands `docs/mvp-roadmap.md` into implementation-level phase documents.

## Phase status & execution order

| Phase | Title | Status | Delivered in / Evidence | Key Deliverables |
|---|---|---|---|---|
| [Phase 0](./phase-00-repository-foundation-and-init.md) | Repository Foundation & Project Init | **Completed** | PR #1 (`plans/261005-0925-...`) | `@tabdo/*` monorepo, pnpm workspaces, migrations `0001` & `0002`, admin bootstrap, CI |
| [Phase 1](./phase-01-auth-portal-admin-provisioning.md) | Authentication, Portal Routing & Admin User Provisioning | **Completed** | PR #1 (`plans/261005-0925-...`) | Shared auth session, `/login` & `/admin/login`, `admin-create-user` Edge Function, `/settings` |
| [Phase 2](./phase-02-core-task-management.md) | Core Task Management | **Completed** | PR #2 (`plans/261005-1305-...`) | Migration `0003`, Task CRUD, priority, checklist subtasks, categories, task drawer, markdown editor |
| [Phase 3](./phase-03-smart-task-views-and-organization.md) | Smart Task Views & Organization | **Completed** | PR #2 (`plans/261005-1305-...`) | Views: Inbox, Today, Upcoming, Completed, Trash; search, filters, sorting, category manager |
| [Phase 4](./phase-04-scheduling-and-calendar.md) | Scheduling & Calendar | **Completed** | PR #3 (`plans/261006-0832-...`) | Migration `0004`, FullCalendar Standard day/week views, schedule blocks, drag/resize, drawer integration |
| [Phase 5](./phase-05-reminder-engine.md) | Reminder Engine | **Completed** | PR #3 (`plans/261006-0832-...`) | Migration `0005`, absolute & relative reminders, presets, snooze/dismiss, auto-dismiss on completion |
| [Phase 6](./phase-06-browser-extension.md) | Browser Extension | **Planned (Next up)** | In queue | WXT MV3 popup, Today sync via `chrome.storage.local`, alarms via `chrome.alarms` & notifications |
| [Phase 7](./phase-07-recurring-tasks.md) | Recurring Tasks | **Planned** | Planned | Recurrence rule schema, auto-regeneration on completion |
| [Phase 8](./phase-08-dashboard.md) | Dashboard | **Planned** | Planned | Productive day metrics, today's agenda, overdue tracking |
| [Phase 9](./phase-09-daily-weekly-summary.md) | Daily & Weekly Summary | **Planned** | Planned | AI/Rule summary of completed vs carried over work |
| [Phase 10](./phase-10-hardening-and-release.md) | MVP Hardening & Release Verification | **Planned** | Planned | Cross-client smoke tests, performance, end-to-end verification |

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
