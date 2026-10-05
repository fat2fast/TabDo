# Phase 3 — Smart Task Views & Organization

**Status:** Planned  
**Depends on:** Phase 2  
**Blocks:** Dashboard and summary UX quality

## 1. Goal

Turn raw personal tasks into useful daily views without forcing the user to manually organize every item.

Primary views:

- Inbox
- Today
- Upcoming
- Overdue
- Completed

Also add:

- filtering
- sorting
- basic search

---

## 2. Navigation

Recommended task navigation:

    Tasks
    ├── Inbox
    ├── Today
    ├── Upcoming
    ├── Overdue
    └── Completed

Possible routes:

    /tasks
    /tasks/inbox
    /tasks/today
    /tasks/upcoming
    /tasks/overdue
    /tasks/completed

Alternatively use one route with query/state if preferred. The URL should remain shareable/bookmarkable within the authenticated app.

---

## 3. Inbox semantics

Inbox behavior must be explicit.

Recommended MVP definition:

> A non-completed task with no due date and no category is considered unorganized and appears in Inbox.

Rule:

    status != done
    AND due_at IS NULL
    AND category_id IS NULL

If this proves too restrictive, later relax to OR.

Avoid ambiguous logic hidden only in UI code. Put the rule in a named query/helper.

---

## 4. Today semantics

Today should answer:

> What requires my attention today?

Recommended sections:

1. Overdue
2. Due today
3. Scheduled today, once Phase 4 exists

Before Phase 4, Today can contain only overdue + due-today tasks.

Use the user's timezone to determine calendar-day boundaries.

Do not compare UTC date strings directly.

---

## 5. Upcoming semantics

Recommended group structure:

- Tomorrow
- This Week
- Later

Only include:

    due_at > end_of_today
    AND status != done

Suggested time boundaries must be timezone-aware.

"This Week" should use a consistent week definition, e.g. Monday–Sunday.

---

## 6. Overdue semantics

Rule:

    due_at < now
    AND status != done

Display:

- amount of overdue time
- due date/time
- priority
- category

Do not mutate the task status to `overdue`.

---

## 7. Completed view

Show recently completed tasks.

Ordering:

    completed_at DESC

Initial scope can be:

- last 30 days
- or paginated recent history

Avoid loading unlimited historical records.

---

## 8. Filtering

Initial filters:

- status
- priority
- category
- due date range

Filter state should be visible and easy to clear.

Do not add advanced boolean filter builders.

---

## 9. Sorting

Initial options:

- due date ascending
- due date descending
- priority
- created date
- updated date

Define explicit priority ordering:

    high
    medium
    low

Do not rely on alphabetical sorting.

---

## 10. Search

MVP search:

- title contains query

Optional:

- description contains query

Use debouncing.

For small MVP datasets, Supabase `ilike` is acceptable.

Do not implement dedicated full-text search infrastructure yet.

---

## 11. Query design

Avoid "load all tasks then filter everything in JavaScript" as the long-term pattern.

Prefer scoped queries by view.

Examples:

### Overdue

    user-owned
    status != done
    due_at < now

### Completed

    user-owned
    status = done
    order by completed_at desc
    limit N

### Upcoming

    user-owned
    due_at > end_of_today

TanStack Query keys should include filter/sort inputs.

---

## 12. Counts

Sidebar may show lightweight counts for:

- Inbox
- Today
- Overdue

Do not issue many expensive duplicate queries on every render.

Options:

- derive counts from currently cached view queries
- use small aggregate RPC later
- initially omit counts if complexity is unnecessary

Correctness matters more than badges.

---

## 13. URL state

Recommended:

- keep search/filter/sort in URL query parameters where useful
- keep temporary drawer state local

Example:

    /tasks/upcoming?priority=high&sort=due_asc

This improves refresh behavior and future deep-linking.

---

## 14. UX behavior

Task completion inside any view should:

1. optimistically update or immediately reflect UI
2. invalidate relevant task views
3. update counts
4. preserve current filters

A task completed in Overdue should disappear from Overdue and appear in Completed.

---

## 15. Timezone cases

Test around:

- 23:59 / 00:00 local time
- UTC conversion
- day boundary
- daylight-saving timezone even if default users are in Vietnam

The application's default timezone is `Asia/Ho_Chi_Minh`, but logic should not assume UTC+7 forever.

---

## 16. Empty states

Provide distinct empty messages:

### Inbox empty

    Inbox trống. Các công việc đã được sắp xếp.

### Today empty

    Hôm nay chưa có công việc đến hạn.

### Overdue empty

    Không có công việc quá hạn.

### Completed empty

    Chưa có công việc hoàn thành.

---

## 17. Suggested components

- `TaskViewHeader`
- `TaskFilters`
- `TaskSort`
- `TaskSearch`
- `TaskGroup`
- `TaskViewEmptyState`
- `InboxView`
- `TodayView`
- `UpcomingView`
- `OverdueView`
- `CompletedView`

Reuse Phase 2's `TaskRow` and `TaskDrawer`.

---

## 18. Tests

Test at least:

- task without due/category appears in Inbox
- categorized task leaves Inbox
- due-today task appears in Today
- completed task does not appear Overdue
- task due one minute ago becomes Overdue
- Upcoming groups are correct
- filters combine correctly
- sort order is deterministic
- search does not return another user's tasks

---

## 19. Out of scope

- saved custom filters
- advanced search syntax
- tags separate from categories
- team views
- assignee filters
- Kanban
- custom dashboards

---

## 20. Definition of Done

Phase 3 is done when a user can reliably answer:

- What have I not organized?
- What needs attention today?
- What is coming next?
- What is overdue?
- What have I completed?

and can narrow those lists with basic search, filters, and sorting.
