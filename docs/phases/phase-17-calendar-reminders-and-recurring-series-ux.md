# Phase 17 — Calendar Planning, Reminder Center & Recurring Series UX

**Status:** Planned  
**Track:** Plan & Remind UX  
**Depends on:** Phases 4, 5, 7, 9, 12–16  
**Delivery:** Post-MVP enhancement — not required for Phase 10 MVP release  
**Scope rule:** Keep one shared Web auth session; preserve per-user RLS; admin may view only numerical task counts, not user task details or perform cross-user task edits.

---

## 1. Goal

Close important UX gaps in planning and reminders without changing the core concepts: **deadline ≠ planned work block** and recurring occurrences preserve their own history.

This phase bundles three related surfaces because they share task time, recurrence and reminder states. Ship as separate PRs within the phase.

## 2. Calendar Month and weekly planning (slice A)

- Add Month calendar view next to existing Day/Week; query only the visible date range using overlap logic.
- Add accessible agenda/list fallback on touch devices (building on Phase 12).
- Make unscheduled tasks discoverable and support assigning them to a work block. A drag/drop scheduling interaction is optional; dialog-based alternative is required.
- Offer an explicit 'Plan my week' workflow: review upcoming tasks, allocate blocks; never silently rewrite due dates.
- Dates, slot boundaries and week starts are calculated in user timezone, with Monday-first as existing convention unless profile preference added.
- Month view must handle many overlapping events, narrow devices and all-day/date-only deadlines intentionally.

## 3. Reminder Center (slice B)

- Add authenticated Web surface for Upcoming / Snoozed / Triggered / Dismissed reminders; decide which old entries to retain and for how long.
- Provide action to Snooze or Dismiss where lifecycle allows. A task's recurrence and due-date changes must remain the authority for relative reminders.
- Show past-due/reminder-missed states honestly; Chrome's local alarms cannot guarantee delivery when browser is closed.
- Distinguish 'scheduled', 'triggered', 'seen' and 'dismissed' if a distinct read/seen state is approved; avoid inventing semantics from notification display alone.
- Keep server source of truth and reconcile Extension alarms; do not introduce background email/push by default.
- A mobile notification center may share the same Web route, but is not itself OS push support.

## 4. Recurring series management (slice C)

- View a recurrence series with current/previous/next occurrences and clear recurrence summary.
- Support Stop future recurrence, skip next and pause/resume **only if** defined as unambiguous DB-level operations; ensure idempotency and ownership.
- For editing, explicitly distinguish 'This occurrence' vs 'This and future occurrences'. Do not claim all-series updates until deterministic series semantics are designed.
- Historical completed rows remain unchanged unless explicitly edited as history.
- Relative reminders for future occurrences use offsets; avoid copying old absolute one-off reminders.
- Test DST gap/fold, month-end anchors, retry and duplicate successor constraints.

## 5. Cross-feature contracts

- Calendar editing updates schedule blocks, not task deadline unless user chooses 'Change deadline'.
- Reminder Center responds to changes in task completion, deletion/restoration and recurrence generation.
- Dashboard and Summary calculations use the same timezone/period conventions; no double-count for multiple schedule blocks.
- Admin aggregate counts remain counts-only; no admin view of other users' schedule/reminder content.

## 6. Suggested files

```text
apps/web/src/features/scheduling/components/month-calendar.tsx
apps/web/src/features/scheduling/components/weekly-planner.tsx
apps/web/src/features/reminders/components/reminder-center.tsx
apps/web/src/features/tasks/components/recurrence-series-manager.tsx
packages/utils/src/recurrence.ts (extend/tests, no forked logic)
```

New migrations/RPCs only if needed for explicit read/seen/series state; author forward migrations and owner-safe tests.

## 7. Delivery plan

1. Month View + agenda interactions.
2. Reminder Center with clear, supported lifecycle.
3. Series history and safe stop/skip flows.
4. Optional future-edit/pause UX after data design review.


---

## Implementation checklist (issue-ready)

- [ ] Reuse FullCalendar setup and visible-range queries for Month without duplicating schedule APIs.
- [ ] Add responsive month/agenda switching, clear task-vs-schedule visual legend.
- [ ] Provide “Plan week” workflow with task selection, work block creation and failure rollback.
- [ ] Define Reminder Center labels and lifecycle transitions from existing reminder model.
- [ ] Introduce separate `seen_at` only if genuinely required, with migration and UX semantics.
- [ ] Ensure local Chrome alarms and new web reminder view reconcile when snoozed/dismissed.
- [ ] Define exact recurrence series operations (stop/skip/pause/edit future) before implementing SQL.
- [ ] Store recurrence series operations with owner RLS, idempotency and history-preserving tests.
- [ ] Check 31st-of-month, DST gap/fold and full-day reminder representation.
- [ ] Review Dashboard and Summary consistency after month/planner operations.

## End-to-end acceptance walkthroughs

1. **Scenario 1:** User plans two 90-minute blocks against one Friday deadline without moving due date.
2. **Scenario 2:** A fired Chrome reminder appears in Reminder Center according to documented triggered/seen semantics; snooze reschedules next alarm.
3. **Scenario 3:** Skipping next recurrence changes future occurrence generation without deleting completed historical task rows.
4. **Scenario 4:** Month and Agenda are consistent in Asia/Ho_Chi_Minh and in DST-active timezone.

## Risks, tradeoffs and open decisions

- Risk: reminder status `triggered` may not prove OS delivery; **mitigation:** separate delivery vs read semantics.
- Risk: series edits mutate history; **mitigation:** transaction model with explicit future-occurrence boundaries.
- Decision: pause/resume may defer to next release if not safely expressible in current recurrence schema.

---

## 8. Tests and DoD

- Month/agenda responsive, timezone-correct, keyboard usable.
- Reminder snooze/dismiss always reconciles extension state without duplicate alarms.
- Recurrence operations preserve prior occurrences, prevent cross-user changes and prevent duplicate successor creation.
- User can plan a week, review reminders and understand the state of an entire recurring series.
