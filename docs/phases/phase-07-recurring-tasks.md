# Phase 7 — Recurring Tasks

**Status:** Planned  
**Depends on:** Phases 2 and 5  
**Benefits:** Dashboard and summaries

## 1. Goal

Allow repeatable personal work while preserving each completed occurrence as historical data.

Core principle:

> Do not keep moving the same completed row forever.

Each completed occurrence should remain in history, and the next occurrence should be generated separately.

---

## 2. Supported recurrence

MVP:

- Daily
- Weekdays
- Weekly
- Monthly
- Custom weekdays

Storage:

    recurrence_rule

Prefer RRULE-compatible strings.

Examples:

    FREQ=DAILY

    FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR

    FREQ=WEEKLY;BYDAY=MO,WE,FR

    FREQ=MONTHLY

The UI should never require users to write RRULE manually.

---

## 3. Recurrence model

A recurring task occurrence is a normal task row.

Recommended additional fields if needed:

- `recurrence_rule`
- `recurrence_series_id`
- `recurrence_parent_id` or equivalent

Why:

- identify tasks in same series
- keep historical occurrence
- generate next one
- support future "edit this vs series" behavior

If schema is kept minimal, document how occurrences are associated.

---

## 4. Generation strategy

Recommended MVP behavior:

When user completes the current occurrence:

1. mark current task done
2. calculate next occurrence
3. insert new task row
4. copy relevant fields
5. preserve series identity
6. generate next reminders as needed

This avoids background cron requirements.

Alternative future approach:

- scheduled generation ahead of time

Not required now.

---

## 5. Fields copied to next occurrence

Usually copy:

- title
- description
- priority
- category
- recurrence_rule
- source_url

Recalculate:

- start_at
- due_at
- reminders

Do not copy:

- completed_at
- status done
- task activity history
- old schedule blocks

Subtask recurrence needs an explicit rule; see below.

---

## 6. Due date calculation

Examples:

### Daily

Current due:

    Oct 5 09:00

Next:

    Oct 6 09:00

### Weekdays

Friday → Monday.

### Weekly

Same weekday/time next week.

### Monthly

Define month-end behavior.

Recommended:

- if recurrence began on the 31st and next month lacks 31, use last valid day of month
- document behavior

Use a tested recurrence library where appropriate rather than hand-writing every calendar edge case.

---

## 7. Timezone

Recurrence should respect user's intended local time.

Example:

    Every Monday at 09:00 Asia/Ho_Chi_Minh

The next occurrence should remain 09:00 local even if user later operates in DST zones.

Store enough context to avoid recurrence drift if supporting arbitrary timezones.

At minimum test with a DST timezone.

---

## 8. Reminder recurrence

For relative reminders:

- recreate using same offset from next occurrence due time

Example:

    Due every Monday 09:00
    Reminder 1 hour before

Next reminder:

    Monday 08:00

For custom absolute reminders, decide whether they recur. Recommended MVP:

- reminders associated with a recurring task should use reusable relative offsets
- one-off custom reminder does not automatically repeat unless user explicitly selects it as recurring

If current schema lacks offset metadata, extend reminder model before implementing recurrence.

---

## 9. Subtasks

Recommended MVP behavior:

- do not automatically recur subtasks initially

Or, if recurring parent templates are important:

- clone direct subtasks when generating next parent occurrence

Choose one behavior and document it.

Simplest: parent recurrence only.

---

## 10. Schedule blocks

Do not automatically copy schedule blocks to next occurrence unless recurrence scheduling is explicitly designed.

Task recurrence and calendar recurrence are separate concerns.

A future phase can add recurring schedule blocks.

---

## 11. Editing recurring tasks

MVP can support only:

    Edit this occurrence

Avoid "this and future" or "entire series" unless needed.

Changing `recurrence_rule` on the current pending occurrence affects future generation.

Past completed occurrences remain unchanged.

---

## 12. Stopping recurrence

Provide:

    Repeat: None

If user removes recurrence from current occurrence:

- current task remains
- no next occurrence is generated

Do not delete historical tasks.

---

## 13. Idempotency

Completion may be retried.

Prevent duplicate next occurrences.

Possible strategies:

- unique series + occurrence key
- transaction/RPC
- store generated-next reference
- server-side function with conflict handling

This is important. A double-click or retry must not create two identical next tasks.

---

## 14. Activity logging

Add events:

- `recurrence_enabled`
- `recurrence_changed`
- `recurrence_disabled`
- `next_occurrence_generated`

This later supports debugging and summaries.

---

## 15. Tests

Must cover:

- daily
- weekdays across Friday→Monday
- weekly custom days
- monthly
- month-end
- timezone/DST
- completion creates one next occurrence
- duplicate completion retry does not create duplicate
- history remains unchanged
- disabling recurrence stops generation
- next reminder calculated correctly

---

## 16. Out of scope

- yearly recurrence
- complex RFC RRULE UI
- recurring schedule blocks
- "edit all future occurrences"
- exception dates
- team recurring tasks

---

## 17. Definition of Done

Phase 7 is done when:

1. User can select supported repeat patterns.
2. Completing an occurrence creates exactly one correct next occurrence.
3. Historical completed rows remain unchanged.
4. Recurring reminders work according to documented rules.
5. Recurrence respects timezone/local-time intent.
6. User can disable recurrence.
