# TabDo — Phase Documents Index

This directory contains the original MVP Phase 0–10 specifications and proposed **post-MVP Phases 11–20**. Implementation details belong in phase docs; the high-level system architecture remains documented in `docs/architecture.md`.

## MVP Phases 0–10

| Phase | Title | Status | Delivered in / Evidence | Key Deliverables |
|---|---|---|---|---|
| [Phase 0](./phase-00-repository-foundation-and-init.md) | Repository Foundation & Project Init | **Completed** | PR #1 (`plans/261005-0925-...`) | `@tabdo/*` monorepo, pnpm workspaces, migrations `0001` & `0002`, admin bootstrap, CI |
| [Phase 1](./phase-01-auth-portal-admin-provisioning.md) | Authentication, Portal Routing & Admin User Provisioning | **Completed** | PR #1 (`plans/261005-0925-...`) | Shared auth session, `/login` & `/admin/login`, `admin-create-user` Edge Function, `/settings` |
| [Phase 2](./phase-02-core-task-management.md) | Core Task Management | **Completed** | PR #2 (`plans/261005-1305-...`) | Migration `0003`, Task CRUD, priority, checklist subtasks, categories, task drawer, markdown editor |
| [Phase 3](./phase-03-smart-task-views-and-organization.md) | Smart Task Views & Organization | **Completed** | PR #2 (`plans/261005-1305-...`) | Views: Inbox, Today, Upcoming, Overdue, Completed; search, filters, sorting, category manager |
| [Phase 4](./phase-04-scheduling-and-calendar.md) | Scheduling & Calendar | **Completed** | PR #3 (`plans/261006-0832-...`) | Migration `0004`, FullCalendar Standard day/week views, schedule blocks, drag/resize, drawer integration |
| [Phase 5](./phase-05-reminder-engine.md) | Reminder Engine | **Completed** | PR #3 (`plans/261006-0832-...`) | Migration `0005`, absolute & relative reminders, presets, snooze/dismiss, auto-dismiss on completion |
| [Phase 6](./phase-06-browser-extension.md) | Browser Extension | **Completed** | PR #4 (`plans/261006-1645-...`) | WXT MV3 popup, Today sync via `chrome.storage.local`, alarms via `chrome.alarms` & notifications |
| [Phase 7](./phase-07-recurring-tasks.md) | Recurring Tasks | **Completed** | PR #7 (`0007`, `0008`, `recurrence.ts`) | Recurrence rule schema, auto-regeneration on completion, timezone/DST handling |
| [Phase 8](./phase-08-dashboard.md) | Dashboard | **Completed** | PR #7 (`DashboardPage.tsx`, metrics) | Productive day metrics, today's agenda, overdue tracking, priority overview |
| [Phase 9](./phase-09-daily-weekly-summary.md) | Daily & Weekly Summary | **Completed** | PR (`SummaryPage.tsx`, metrics) | Rule-based daily/weekly summary of completed, pending, carried-over, and overdue work |
| [Phase 10](./phase-10-hardening-and-release.md) | MVP Hardening & Release Verification | **Planned** | In Progress | Cross-client smoke tests, performance, end-to-end verification, security audits |

## Proposed Post-MVP Phases 11–20

| Phase | Group | File | Priority |
|---|---|---|---|
| 11 | Post-MVP Core Reliability | [Data Safety, Trash & Storage Modernization](./phase-11-data-safety-and-storage-modernization.md) | P0 |
| 12 | UX Foundation | [Mobile-First Web Experience & Responsive Foundation](./phase-12-mobile-first-web-experience.md) | P0 |
| 13 | UX Core | [Kanban Board & Status Interaction UX](./phase-13-kanban-board-and-task-interactions.md) | P1 |
| 14 | Mobile Delivery | [Installable PWA & Safe Offline Shell](./phase-14-installable-pwa-foundation.md) | P1 |
| 15 | Everyday Workflow UX | [Quick Capture, Bulk Actions & Faster Task Interactions](./phase-15-quick-capture-and-productivity-actions.md) | P1 |
| 16 | Find & Organize UX | [Global Search, Pagination, Saved Views & Templates](./phase-16-global-search-pagination-and-saved-views.md) | P1 |
| 17 | Plan & Remind UX | [Calendar Planning, Reminder Center & Recurring Series UX](./phase-17-calendar-reminders-and-recurring-series-ux.md) | P2 |
| 18 | Trust & Polish | [Data Portability, Accessibility & Personalization](./phase-18-data-portability-accessibility-and-personalization.md) | P2 |
| 19 | Optional Post-MVP Infrastructure | [Advanced PWA: Offline Sync, Web Push & Share Target](./phase-19-advanced-pwa-offline-and-web-push.md) | P3 / Optional |
| 20 | Optional Post-MVP Product | [Focus Mode, Task Templates & Personal Workflow Enhancements](./phase-20-focus-mode-and-personal-workflow.md) | P3 / Optional |

See [`../post-mvp-roadmap.md`](../post-mvp-roadmap.md) for grouped priorities, dependencies, and release recommendations.

## Product constraints & privacy invariants

- No public registration (public self-signup is disabled at the Supabase Auth layer; normal users are provisioned exclusively by administrators).
- One shared Supabase Auth session for the web application:
  - `/login` is the User Portal login entry.
  - `/admin/login` is the Admin Portal login entry.
  - `admin` can use both User Portal and Admin Portal.
  - `user` can use only User Portal.
- TabDo Admin Portal supports user-account administration and numerical task statistics. Administrators may view task counts by status and by account but cannot access, inspect, or modify other users' individual task data, reminders, schedules, or task content.
- Untrusted clients: Treat both `apps/web` and `apps/extension` as untrusted clients. Never expose, import, log, or bundle `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.
- Browser extension operates under least privilege with user-triggered activation (on-demand injection via context menu, no broad `*://*/*` permissions).
- Personal task data remains user-owned and isolated by RLS.
- Supabase provides Auth, PostgreSQL, RLS, and Edge Functions as the remote source of truth; Vercel hosts the Web SPA.
- Browser extension uses WXT + React + Manifest V3.
- Preserve task deadline vs schedule block separation and recurring task completion idempotency.
- Advanced PWA offline sync and Web Push are separate from installable basic PWA.

## Definition of the core product loop

Capture → Organize → Schedule → Remind → Complete → Review

The implementation should prioritize this loop before visual polish or advanced analytics.

## Working practice

Each new phase stays `Planned` until its acceptance tests/DoD are verified, at which point update status and PR evidence in this index. Avoid backfilling claims of release readiness solely from merged code.
