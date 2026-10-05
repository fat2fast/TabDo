# Phase 2 — Core Task Management

**Status:** Planned  
**Depends on:** Phase 1  
**Blocks:** Smart Views, Calendar, Reminders, Dashboard, Summary

## 1. Goal

Deliver the core personal task workflow:

> Capture a task quickly, enrich it when needed, update it, complete it, and keep it isolated to the signed-in user.

This phase is the product foundation. Later phases should build on this model rather than introduce a second task representation.

---

## 2. Core task model

Required fields:

- `id`
- `user_id`
- `parent_id`
- `category_id`
- `title`
- `description`
- `status`
- `priority`
- `start_at`
- `due_at`
- `completed_at`
- `source_url`
- `recurrence_rule`
- `created_at`
- `updated_at`

`recurrence_rule` is stored now but recurrence behavior is implemented in Phase 7.

---

## 3. Status rules

Supported statuses:

    todo
    in_progress
    done

Do not add `overdue` to the status enum.

Derived overdue rule:

    due_at IS NOT NULL
    AND due_at < now
    AND status != done

When a task is completed:

- set `status = done`
- set `completed_at = current timestamp`

When reopened:

- set status back to `todo` or previous non-done status
- clear `completed_at`

For MVP, reopening to `todo` is acceptable and simpler.

---

## 4. Priority rules

Supported:

    low
    medium
    high

Default:

    medium

Do not create complex priority scoring in MVP.

---

## 5. Quick Add

Quick Add is a primary interaction and should be optimized for speed.

Minimum input:

- title

Optional quick fields:

- due date/time
- priority
- category

User should be able to press Enter to create.

Do not require:

- description
- category
- deadline
- reminder
- schedule block

This supports capture-first behavior.

---

## 6. Full Task Detail

Use a drawer or side panel instead of navigating away for every edit.

Task detail should allow editing:

- title
- description
- status
- priority
- category
- start date/time
- due date/time
- source URL
- subtasks

Reminder UI can be visually reserved but full reminder functionality belongs to Phase 5.

Recommended autosave strategy:

- explicit save for large form initially, or
- field-level mutation with debounce

Choose one consistent pattern.

Avoid accidental write storms.

---

## 7. Task list

Initial task list should display:

- completion checkbox
- title
- status
- priority
- due date/time
- category

Optional:

- subtask count

Interactions:

- click checkbox → complete/reopen
- click row/title → open detail
- quick inline due date or priority only if implementation remains simple

---

## 8. Categories

Categories are personal.

Fields:

- id
- user_id
- name
- optional icon
- optional color

Actions:

- create
- rename
- delete

Deletion behavior:

- category deletion should not delete tasks
- set `tasks.category_id` to null using FK behavior

Normal users and admins only see their own categories.

---

## 9. Subtasks

Use `tasks.parent_id`.

Example:

    Prepare monthly report
    ├── Collect HR data
    ├── Review payroll numbers
    └── Write summary

Rules for MVP:

- one level of UI nesting is enough
- database may technically support deeper nesting
- subtasks inherit no deadline/status automatically
- completing parent does not automatically complete all subtasks unless explicitly designed later

Avoid complex dependency logic.

---

## 10. Ownership

Every task mutation must be scoped to the signed-in user.

Recommended queries include `user_id = auth.uid()` through RLS.

The client should not be able to insert a task for another user's `user_id`.

Prefer server/database defaults or client assignment from current session plus RLS enforcement.

---

## 11. Shared query layer

Create a feature-level task data layer, for example:

    features/tasks/
    ├── api/
    │   ├── createTask.ts
    │   ├── updateTask.ts
    │   ├── deleteTask.ts
    │   └── listTasks.ts
    ├── components/
    ├── hooks/
    └── types.ts

TanStack Query should own server-state caching.

Suggested query keys:

    ['tasks']
    ['tasks', 'list', filters]
    ['tasks', 'detail', taskId]
    ['categories']

After mutations, invalidate only relevant queries.

---

## 12. Validation

Validate:

- title must not be blank
- title maximum length
- description maximum length if desired
- due/start timestamps valid
- category belongs to current user
- parent task belongs to current user
- parent task cannot equal itself

Client validation improves UX; database/RLS remains the security boundary.

---

## 13. Activity logging

Phase 2 should begin recording important actions to `task_activities`.

Recommended actions:

- `created`
- `updated`
- `completed`
- `reopened`
- `deleted` if soft-deletion is not used, consider whether history is necessary
- `deadline_changed`
- `priority_changed`

For MVP, activity records can be generated in application mutations.

Later, database triggers may be considered if stronger audit consistency is required.

---

## 14. Time handling

Store timestamps as `timestamptz`.

Display in user's profile timezone.

Do not store formatted date strings.

For date-only deadlines, define a clear product rule. Recommended:

- if user selects a date but no time, represent it explicitly in UI as "Due that day"
- either store a configured default time or add a future date-only field

For MVP, using a default local end-of-day time is acceptable if documented and consistently handled.

---

## 15. Error states

Task UI must handle:

- insert failure
- update failure
- delete failure
- stale task not found
- category deleted while form is open
- network failure

Do not silently discard edits.

Use clear toast/message behavior.

---

## 16. Empty states

At minimum:

### No tasks

Message such as:

    Chưa có công việc nào.
    Tạo công việc đầu tiên để bắt đầu.

Include Quick Add.

### No subtasks

Do not render unnecessary empty table chrome.

---

## 17. Suggested UI components

- `QuickAddTask`
- `TaskList`
- `TaskRow`
- `TaskCheckbox`
- `TaskDrawer`
- `TaskForm`
- `PrioritySelect`
- `CategorySelect`
- `DueDatePicker`
- `SubtaskList`
- `CategoryManager`

---

## 18. Tests

### Data rules

- cannot create blank title
- completing task sets completed_at
- reopening clears completed_at
- deleting category preserves tasks
- subtask references valid parent
- RLS blocks another user's task

### UI flows

- quick add
- edit task
- complete task
- reopen task
- create category
- create subtask

---

## 19. Out of scope

- assignment to another user
- comments
- followers
- attachments
- dependencies
- custom fields
- recurrence generation
- reminder firing
- calendar drag/drop
- AI task parsing

---

## 20. Definition of Done

Phase 2 is done when a signed-in account can:

1. Create a task from Quick Add.
2. Open task detail.
3. Edit all MVP task fields.
4. Delete a task.
5. Complete/reopen a task.
6. Create/use/delete categories.
7. Create subtasks.
8. Refresh the page without losing state.
9. Never access another user's task data.
10. Produce enough task activity history for later summaries.
