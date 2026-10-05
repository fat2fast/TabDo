# Phase 10 — MVP Hardening & Release Verification

**Status:** Planned  
**Depends on:** Phases 0–9  
**Blocks:** MVP release

## 1. Goal

Stabilize the complete MVP for real personal usage and early testers.

No major new product feature should be introduced in this phase.

Focus:

- security
- data integrity
- reliability
- errors
- performance
- deployment
- documentation
- end-to-end verification

---

## 2. Full architecture review

Confirm final MVP architecture:

    Vercel
      → React/Vite Web

    Supabase
      → Auth
      → PostgreSQL
      → RLS
      → Edge Functions

    Browser Extension
      → WXT / Manifest V3
      → Supabase anon client
      → chrome.storage
      → chrome.alarms
      → chrome.notifications

No core business flow should depend on hidden local developer state.

---

## 3. Authentication verification

Verify:

- no public registration
- `/login` works
- `/admin/login` works
- both use one shared web session
- admin switches portals without re-authentication
- normal user cannot access `/admin/*`
- normal user hitting `/admin/login` is not unnecessarily logged out
- logout clears session
- refresh restores session
- expired sessions are handled gracefully

---

## 4. Admin provisioning verification

Verify:

- bootstrap script creates initial admin
- running bootstrap twice is safe
- bootstrap secrets remain server-side
- admin can create normal user
- normal user cannot call user-creation function successfully
- created account role is always `user`
- request cannot create a second admin through client payload
- Edge Function returns safe error messages

---

## 5. RLS review

Test every user-owned table with at least two users.

Tables:

- profiles
- categories
- tasks
- reminders
- schedule_blocks
- task_activities

For each table verify:

- user A cannot select user B row
- user A cannot insert row owned by B
- user A cannot update B
- user A cannot delete B

Admin must not bypass personal-data isolation.

---

## 6. Data integrity review

Review cross-table ownership.

Important:

- task category belongs to same user
- task parent belongs to same user
- reminder task belongs to same user
- schedule task belongs to same user

RLS may block practical cross-user usage, but database constraints or trusted validation should also reduce invalid references.

Consider composite unique/FK patterns if appropriate.

---

## 7. Timezone verification

Default:

    Asia/Ho_Chi_Minh

Also test:

- UTC
- one DST timezone such as America/New_York

Verify:

- task due times
- Today boundaries
- calendar blocks
- reminder times
- snooze
- recurring tasks
- daily summary
- weekly summary

Focus on midnight and DST transitions.

---

## 8. Recurrence reliability

Verify:

- duplicate completion does not create duplicate next occurrence
- monthly edge cases
- weekday recurrence
- next reminder generation
- disabling recurrence
- history preservation

If generation is not transaction-safe, fix it before release.

---

## 9. Extension reliability

Test:

- fresh install
- browser restart
- extension service-worker restart
- auth restore
- session expiry
- upcoming reminder sync
- alarm reconciliation
- reminder edited on web
- reminder deleted on web
- task completed on web
- snooze
- Done
- Open
- temporary network outage

The extension must not accumulate stale duplicate alarms.

---

## 10. Error handling

Web and extension should handle:

- Supabase unavailable
- network offline
- auth expired
- RLS rejection
- duplicate email
- invalid task input
- failed task save
- failed calendar mutation
- failed reminder mutation
- failed Edge Function call

Use user-friendly messages.

Do not expose raw Service Role/API details.

---

## 11. Loading, empty, and stale states

Every major surface should intentionally support:

- loading
- empty
- error
- success

Surfaces:

- Dashboard
- Tasks
- Inbox
- Today
- Upcoming
- Overdue
- Calendar
- Summary
- Admin Users
- Extension Today

Extension cache should indicate stale data when appropriate.

---

## 12. Performance review

Avoid:

- loading all tasks on every route
- unbounded Completed history
- one query per task row
- minute-by-minute Supabase polling
- unnecessary Realtime subscriptions
- repeated profile queries

Use:

- indexes
- scoped date ranges
- pagination/limits
- TanStack Query cache
- extension local cache

---

## 13. Database query review

Use Supabase logs/explain tools where available.

Check common queries:

- Today
- Overdue
- Upcoming
- task detail
- reminders next 7 days
- calendar visible range
- weekly summary

Add indexes only when justified.

---

## 14. Accessibility and UX

Verify:

- keyboard navigation
- visible focus
- accessible labels
- form error text
- sufficient contrast
- buttons have clear names
- dialog/drawer focus management
- notification actions understandable

MVP does not need perfect WCAG certification, but basic accessibility should not be ignored.

---

## 15. Responsive behavior

Verify web at:

- typical desktop
- laptop
- tablet-ish narrow width

The product is desktop-first, but screens should not break badly.

Extension popup should respect browser popup dimensions.

---

## 16. CI requirements

Required CI checks:

- install
- typecheck
- lint
- build web
- build extension

Recommended:

- unit tests
- selected integration tests
- migration validation
- Edge Function tests

No production secrets in CI unless deployment explicitly requires them and uses secure repository/environment secrets.

---

## 17. Deployment

### Web

Deploy to Vercel.

Verify:

- environment variables
- SPA rewrites
- direct route refresh
- custom domain later if used

### Supabase

Apply production migrations in controlled order.

Deploy:

    admin-create-user

Configure server-side secrets.

Run admin bootstrap in trusted environment.

### Extension

For MVP:

- manual unpacked/internal distribution is acceptable

Before public store release:

- privacy disclosure
- icons
- store metadata
- permission review

Public store publishing is optional for initial MVP completion.

---

## 18. Backup and migration safety

Before meaningful testers:

- confirm Supabase backup capabilities for chosen plan
- keep migrations committed
- never edit old production migration history casually
- create new forward migrations for schema changes

Document rollback strategy for high-risk migrations.

---

## 19. Documentation

Final docs should include:

    README.md
    docs/mvp-roadmap.md
    docs/phases/*
    docs/architecture.md
    docs/database.md
    docs/auth.md
    docs/extension.md
    docs/deployment.md

Minimum setup documentation:

- prerequisites
- install
- env configuration
- Supabase migration
- admin bootstrap
- dev web
- dev extension
- build
- deploy

---

## 20. End-to-end release scenarios

### Scenario A — Fresh environment

1. Create/configure Supabase.
2. Apply migrations.
3. Configure secrets.
4. Bootstrap admin.
5. Deploy Edge Function.
6. Deploy web.
7. Admin signs in.

### Scenario B — User provisioning

1. Admin enters `/admin/login`.
2. Admin creates user.
3. User signs in at `/login`.
4. User cannot access `/admin/users`.

### Scenario C — Core productivity

1. User creates task.
2. Adds due date.
3. Adds reminder.
4. Schedules work block.
5. Extension syncs reminder.
6. Notification fires.
7. User snoozes.
8. Notification fires again.
9. User completes task.
10. Dashboard updates.
11. Summary reflects completion.

### Scenario D — Admin as personal user

1. Admin enters User Portal.
2. Creates own personal task.
3. Uses calendar/reminders.
4. Switches to Admin Portal.
5. Creates user.
6. Returns through "Cổng người dùng".
7. Own personal task remains accessible.
8. Other users' personal data remains inaccessible.

---

## 21. Release blockers

Do not release if any of these remain:

- Service Role key in client bundle/repo
- public signup still enabled through UI unintentionally
- normal user can invoke admin creation successfully
- admin can read another user's personal tasks
- duplicate recurrence creation
- reminders duplicate after extension restart
- route refresh causes 404
- production migration fails
- CI build fails
- major timezone errors

---

## 22. MVP Definition of Done

The MVP is complete when both chains work reliably.

### Provisioning chain

    Environment setup
        ↓
    Bootstrap Admin
        ↓
    Admin Sign In
        ↓
    User Portal ↔ Admin Portal
        ↓
    Create User
        ↓
    User Sign In

### Personal productivity chain

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

And the system maintains user-data isolation throughout.
