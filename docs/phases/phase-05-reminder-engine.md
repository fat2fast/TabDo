# Phase 5 — Reminder Engine

**Status:** Planned  
**Depends on:** Phase 2  
**Blocks:** Phase 6 extension notifications

## 1. Goal

Implement a reliable reminder data model and synchronization contract that the browser extension can consume.

This phase focuses on reminder creation, storage, state transitions, and query behavior. Native browser notification delivery is completed in Phase 6.

---

## 2. Reminder model

A task may have multiple reminders.

Table fields:

- `id`
- `user_id`
- `task_id`
- `remind_at`
- `status`
- `snoozed_until`
- `created_at`
- `updated_at`

Suggested statuses:

    pending
    triggered
    snoozed
    dismissed

Do not store a single `reminder_at` on tasks.

---

## 3. Reminder types

For MVP, reminders can all be stored as absolute `remind_at` timestamps even if created from presets.

User-facing presets:

- At due time
- 5 minutes before
- 15 minutes before
- 30 minutes before
- 1 hour before
- 1 day before
- Custom

Example:

Task due:

    2026-10-05 17:00 Asia/Ho_Chi_Minh

"1 hour before" becomes an absolute timestamp corresponding to:

    2026-10-05 16:00 Asia/Ho_Chi_Minh

This simplifies extension scheduling.

---

## 4. Reminder dependency on task due date

Product decision required:

If a reminder was created as "1 hour before due" and the due date later changes, should reminder move automatically?

Recommended MVP behavior:

- store reminder preset metadata if practical
- recalculate relative reminders when task due date changes
- custom absolute reminder remains unchanged

If metadata is not added yet, simpler MVP behavior is:

- treat all reminders as absolute after creation
- user manually updates them

Choose and document one behavior before implementation.

Preferred long-term model:

- `reminder_kind`: relative_due | absolute
- `offset_minutes`: nullable
- `remind_at`: resolved execution time

---

## 5. Create reminder

Task detail should allow:

    + Add reminder

Preset selection resolves to `remind_at`.

Validation:

- task belongs to current user
- reminder belongs to current user
- valid timestamp
- duplicate reminders handled gracefully

Duplicate exact reminder times may either be prevented or allowed; preventing duplicates is simpler UX.

---

## 6. Reminder list

Task detail should show all reminders chronologically.

Example:

    Reminders
    • 09:00 on due date
    • 1 hour before
    • At due time

Actions:

- edit
- delete

Do not expose internal statuses unnecessarily unless useful.

---

## 7. Snooze model

When a triggered reminder is snoozed:

- set `status = snoozed`
- set `snoozed_until`

Extension should schedule next firing from `snoozed_until`.

Suggested options:

- 15 minutes
- 30 minutes
- 1 hour
- custom

After snoozed reminder fires again, status may become `triggered`.

---

## 8. Dismiss behavior

If user dismisses notification intentionally:

- set status `dismissed`

Do not repeatedly re-fire a dismissed reminder.

If user simply ignores a browser notification, define behavior carefully. Browser APIs may not always report intent reliably.

For MVP, notification close can be treated as no-op or dismissed depending on API reliability. Document the chosen behavior.

---

## 9. Completing a task

When task becomes `done`:

- future pending reminders for the task should no longer fire

Recommended:

- mark future pending/snoozed reminders as `dismissed`
- or have extension ignore reminders for completed tasks

Database state cleanup is preferable for consistency.

If task is reopened, do not automatically restore old dismissed reminders unless explicitly desired.

---

## 10. Upcoming reminder query

The extension needs an efficient query.

Recommended time horizon:

    now → now + 7 days

Query filters:

- current user
- status in pending/snoozed
- effective fire time within horizon

For snoozed reminders, effective fire time is `snoozed_until`.

Avoid polling every minute.

---

## 11. Synchronization contract

Define a stable shared representation consumed by extension.

Example:

    {
      id,
      taskId,
      taskTitle,
      dueAt,
      remindAt,
      status,
      snoozedUntil,
      updatedAt
    }

This contract belongs in shared types.

The extension should be able to compare `updatedAt` and rebuild local alarms when records change.

---

## 12. Sync triggers

Recommended:

- extension startup
- extension installed/updated
- popup opened
- after reminder mutation in extension
- periodic background sync
- optionally web-triggered realtime later

Initial periodic sync can be every 15–30 minutes.

Local alarms handle exact reminder timing between syncs.

---

## 13. Timezone handling

`remind_at` is an absolute timestamp.

The web UI converts local selection using `profile.timezone`.

The extension schedules based on the absolute timestamp.

Do not add or subtract timezone offsets twice.

Test with:

- Asia/Ho_Chi_Minh
- UTC
- one DST timezone

---

## 14. Reminder UI on task detail

Suggested:

    Reminders
    ├── 1 hour before
    ├── 15 minutes before
    └── + Add reminder

For custom reminder:

- date picker
- time picker

Do not require the task to have a due date for custom absolute reminders.

Relative presets require a due timestamp.

---

## 15. Data integrity

Ensure reminder `task_id` belongs to same `user_id`.

RLS should prevent cross-user reads/writes.

Consider composite constraints or trusted validation to prevent a user from referencing another user's task ID even if RLS already blocks practical access.

---

## 16. Tests

- multiple reminders per task
- preset timestamp calculation
- custom reminder without due date
- relative reminder rejected if no due date
- snooze updates next fire time
- completed task suppresses future reminders
- deleted task cascades/removes reminders as intended
- another user cannot access reminder
- DST/timezone conversion test

---

## 17. Out of scope

- email reminder
- SMS
- push service independent of browser
- mobile notifications
- calendar event notifications
- location-based reminder
- complex automation rules

---

## 18. Definition of Done

Phase 5 is done when:

1. User can add multiple reminders to a task.
2. Presets and custom times are stored correctly.
3. User can edit/delete reminders.
4. Snooze state is represented correctly.
5. Completion prevents future reminder firing.
6. Upcoming-reminder query is efficient.
7. Shared reminder contract is ready for extension.
8. Timezone behavior is verified.
