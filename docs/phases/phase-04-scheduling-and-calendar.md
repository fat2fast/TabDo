# Phase 4 — Scheduling & Calendar

**Status:** Completed  
**Depends on:** Phase 2; benefits from Phase 3  
**Blocks:** Dashboard schedule section and richer planning workflow  
**Completed via:** PR #3 (`plans/261006-0832-scheduling-calendar-reminder-engine`)

## 1. Goal

Introduce time planning without confusing scheduled work time with task deadline.

Core rule:

> A task's due time answers "when must this be finished?"  
> A schedule block answers "when do I plan to work on this?"

These are separate concepts and separate records.

---

## 2. Schedule block model

Use `schedule_blocks`.

Required fields:

- `id`
- `user_id`
- `task_id` nullable
- `title`
- `start_at`
- `end_at`
- `created_at`
- `updated_at`

Rules:

- `end_at > start_at`
- `task_id` may be null
- if task_id exists, referenced task must belong to the same user
- deleting a task should not necessarily delete historical schedule blocks unless product decision says so

Recommended FK:

- `ON DELETE SET NULL` for task_id

This preserves calendar entries if the source task is removed.

---

## 3. Calendar views

MVP priority:

1. Day
2. Week

Month view is optional.

Default route:

    /calendar

View state can be encoded:

    /calendar?view=week&date=2026-10-05

---

## 4. Schedule block creation

User should be able to create a block from:

- empty calendar slot
- explicit Add Schedule action
- existing task

Fields:

- title
- start date/time
- end date/time
- optional task link

If created from a task, default title to task title but allow editing.

---

## 5. Linking task and schedule

A task may have:

- zero schedule blocks
- one schedule block
- multiple schedule blocks

Example:

    Task: Prepare monthly report
    Due: Friday 17:00

    Schedule:
    Thursday 14:00–15:00 — Collect data
    Friday 09:00–10:30 — Finalize report

Do not restrict tasks to a single scheduled session.

---

## 6. Calendar interaction

MVP baseline:

- click empty time → create
- click block → edit
- delete block
- move block
- resize duration

If drag/resize implementation risks delaying the phase, ship create/edit first and add drag/resize before phase completion.

---

## 7. Unscheduled tasks

Provide a practical way to schedule an existing task.

Possible UI:

- side panel of unscheduled tasks
- task detail "Schedule" action
- Today view "Add to calendar"

Drag-and-drop is desirable but not required for the first internal milestone.

---

## 8. Time collision behavior

For MVP, overlapping schedule blocks are allowed.

Do not implement automatic conflict prevention.

Optionally show visual overlap.

This keeps the calendar flexible and avoids turning TabDo into a meeting-booking system.

---

## 9. Timezone behavior

Store:

    timestamptz

Render in:

    profile.timezone

When user changes timezone later, schedule blocks represent absolute moments and will display accordingly.

For all-day blocks, defer specialized all-day semantics unless needed.

---

## 10. Data queries

Calendar should query only the visible range.

Example week query:

    start_at < visible_end
    AND end_at > visible_start

This correctly includes blocks crossing range boundaries.

Do not load all historical schedule blocks.

---

## 11. Calendar library decision

Choose a library only if it reduces implementation complexity.

Evaluate:

- FullCalendar
- React Big Calendar
- custom lightweight day/week grid

Selection criteria:

- React support
- drag/resize support
- timezone behavior
- bundle size
- styling flexibility
- license compatibility

Document the choice.

---

## 12. Task detail integration

Task drawer should show:

- due date
- scheduled sessions

Example:

    Deadline
    Fri 17:00

    Scheduled
    Thu 14:00–15:00
    Fri 09:00–10:30

Action:

    + Schedule time

This reinforces deadline vs schedule distinction.

---

## 13. Today integration

After Phase 4, Today view can include tasks scheduled today even if due later.

Recommended grouping:

- Overdue
- Due Today
- Scheduled Today

Avoid duplicate rows if the same task is both due and scheduled today. Either:

- show once with both indicators
- or define section precedence

Document the rule.

---

## 14. Activity logging

Recommended activity events:

- `schedule_created`
- `schedule_updated`
- `schedule_deleted`

Task activity may reference schedule block metadata where useful.

Do not log every drag pixel movement; persist/log only final change.

---

## 15. Error handling

Handle:

- invalid time range
- deleted linked task
- concurrent update
- network failure during drag/resize

For drag/resize, if save fails, restore previous position and notify the user.

---

## 16. Suggested components

- `CalendarPage`
- `DayCalendar`
- `WeekCalendar`
- `ScheduleBlockCard`
- `ScheduleEditor`
- `UnscheduledTasks`
- `ScheduleTaskAction`
- `CalendarToolbar`

---

## 17. Tests

At minimum:

- create independent block
- create block linked to task
- edit time
- delete block
- query visible range
- block crossing midnight
- user cannot link to another user's task
- user cannot read another user's schedule
- deadline changes do not automatically move schedule block
- schedule changes do not automatically change deadline

---

## 18. Out of scope

- Google Calendar sync
- shared calendar
- meeting invitations
- resource booking
- time tracking
- automatic rescheduling
- AI time blocking

---

## 19. Definition of Done

Phase 4 is done when the user can:

1. See day/week calendar.
2. Create schedule blocks.
3. Link a block to a task.
4. Keep task deadline independent.
5. Edit/move/resize/delete schedule blocks.
6. Query only relevant calendar ranges.
7. See scheduled work reflected in Today and later Dashboard.
