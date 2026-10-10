# TabDo — Post-MVP Enhancement Roadmap (Phases 11–20)

**Status:** Proposal / Planned  
**Baseline:** Post-Phase-10 enhancements; review implementation against current `main` before each phase begins.  
**Document format:** These phase documents extend rather than replace `docs/mvp-roadmap.md` and Phases 0–10.

## 1. Product direction

TabDo is a private personal-productivity application with complementary surfaces:

- **Desktop Web:** deep organization, task management and planning.
- **Mobile Web / PWA:** capture, view Today, complete tasks, plan with simplified agenda.
- **Browser Extension:** task capture triggered by the user, Today access and local reminders in supported desktop browsers.

The extension remains a companion, not a second full web application. Supabase Auth/Postgres/RLS are the backend; Vercel hosts static Web. Do not introduce public signup or team ownership as part of these phases.

## 2. Phase grouping

| Group | Phase | Focus | Priority | Suggested release bucket |
|---|---|---|---|---|
| Reliability & Trust | 11 | Trash/Restore; private attachments; metadata migration | P0 | v1.1 foundation; promote earlier if data risk blocks MVP |
| Mobile UX | 12 | Responsive AppShell; bottom nav; full-screen Task; mobile agenda | P0 | v1.1 |
| Visual Task Management | 13 | List/Board toggle, status lanes, DnD, mobile alternative | P1 | v1.1 |
| Mobile Delivery | 14 | Installable PWA, static shell cache, safe update/launch UX | P1 | v1.1 |
| Everyday Workflow | 15 | Better Quick Add, Extension capture, actions, bulk, undo, shortcuts | P1 | v1.2 |
| Discoverability | 16 | Global search, pagination, saved views, optional templates | P1 | v1.2 |
| Planning UX | 17 | Month calendar, weekly planning, reminder center, recurrence series | P2 | v1.2 |
| User Control & Polish | 18 | Export/import, dark mode, accessibility/localization | P2 | v1.2 |
| Advanced Mobile | 19 | Offline sync, web push, share target | P3 / conditional | v1.3+ |
| Focus & Habits | 20 | Focus timer/session, optional personal workflow presets | P3 / conditional | v1.3+ |

**Priorities are product recommendations, not actual repo completion claims.** Phases 19 and 20 require evidence of demand and an explicit go/no-go before implementation.

## 3. Recommended execution graph

```text
Phase 10 (MVP release gates)
  │
  ├── Phase 11 Data Safety ────────────────────────────────────────┐
  │                                                               │
  └── Phase 12 Mobile-first UX ──┬── Phase 13 Kanban ───────────────┤
                                 └── Phase 14 PWA Basic ────────┐  │
                                                                  │  │
  Phase 15 Quick Capture & Actions ← Phases 11–14 ──────────────────┤  │
  Phase 16 Search & Saved Views ← Phase 15 ────────────────────────┤  │
  Phase 17 Calendar/Reminders/Recurrence UX ← 12/13/15/16 ─────────┤  │
  Phase 18 Portability/Personalization ← 11/12/16/17 ──────────────┘  │
  Phase 19 Advanced PWA/Offline (optional) ← 11/12/14/15/18 ─────────┘
  Phase 20 Focus Mode (optional) ← core UX phases
```

The numbers are an organizational order, not a requirement to serialize every PR. Phase 11 can start in parallel with Phase 12. **Do not delay critical data-safety work** while waiting for visual features.

## 4. MVP versus post-MVP

- Phases **0–10** define original MVP functionality and release hardening.
- Phases **11–18** are proposed enhancements and do **not** retrospectively expand Phase 10 acceptance criteria.
- Phases **19–20** are optional experiments/advanced infrastructure, not guaranteed commitments.
- Security corrections discovered during review (no public signup, least-privilege extension permissions, admin counts-only privacy) are **existing safety obligations**, not feature additions; fix them as blockers independent of phase numbering.

## 5. Admin scope clarification

The agreed Admin Portal may create/list/activate/deactivate normal user accounts and see **numerical** task statistics by status and account. It must not return task titles, descriptions, attachments, reminders, schedules, activity details, or permit modification of another user's task rows. No client/service-role secrets in Web or Extension. Personal data ownership is unchanged.

## 6. Quality gates common to all phases

- Scope and acceptance criteria agreed before code changes; preserve existing single-session auth.
- Migrations are forward-only and tested locally/UAT with RLS; client-visible credentials are publishable/anon only.
- Cross-client consistency (Web, Extension, PWA) on task status/recurrence/reminders/timezone.
- Responsive and keyboard/screen-reader behavior tested where a UI is modified.
- Failures shown clearly; no fake success, silent data loss or unverified 'offline' claims.
- Typecheck, applicable Web/Extension tests, build, and relevant Supabase integration tests actually executed.
- Documentation status updated only after verification; preserve release evidence/PR links.

## 7. Measurements and exit criteria (to calibrate after UAT)

Use metrics *without collecting unnecessary user content*:

- Task capture completion rate / common validation errors (aggregated, opt-in telemetry if introduced).
- Mobile layout usability at 360/390/428px; no horizontal page overflow; task creation works with keyboard open.
- Board task status change success/failure; no duplicate recurring successors.
- PWA install and update success on eligible browsers, with platform limitations documented.
- Search latency over realistic private datasets and completeness beyond prior task limits.
- Reminder sync/notification duplicate rate and recovery after restart.
- Backup/export and restore success, without cross-user leakage.

## 8. Explicitly excluded for this roadmap

- Native mobile app, team collaboration/workspaces, cross-user task assignment, arbitrary admin access to personal tasks.
- AI agent automatic scheduling, complex gamification, microservices.
- Third-party OAuth integrations (Google Calendar/Gmail/Slack/etc.) until separately approved with token lifecycle and privacy review.
