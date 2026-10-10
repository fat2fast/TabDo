# Phase 8 — Dashboard

**Status:** Completed (subject to acceptance verification)  
**Depends on:** Phases 2–5  
**Benefits from:** Phase 7  
**Delivered in:** PR #7 (`plans/261009-0009-recurring-tasks-dashboard`)

## 1. Goal

Provide one actionable landing page that answers:

- What should I care about now?
- How much have I completed today?
- What is overdue?
- What is on my schedule today?
- What deadlines are coming next?

The dashboard should be useful, not decorative.

---

## 2. Route

    /dashboard

Both normal users and admin accounts may use it as their personal dashboard.

All data is scoped to the current authenticated user.

---

## 3. Dashboard sections

Recommended MVP order:

1. Today overview
2. Priority tasks
3. Today's schedule
4. Upcoming deadlines
5. Overdue attention

Avoid a wall of charts.

---

## 4. Today overview

Metrics:

- tasks relevant today
- completed today
- remaining today
- overdue count
- completion percentage

Define exactly what "tasks relevant today" means.

Recommended after calendar exists:

- due today
- scheduled today
- overdue carried into today

Avoid double-counting a task that is both due and scheduled today.

Use a unique task set.

---

## 5. Completion percentage

Example:

    completedRelevantTasks / totalRelevantTasks * 100

If total is zero:

- show 0% or a neutral "No planned tasks"
- avoid division errors

Document the metric so Summary uses compatible definitions.

---

## 6. Priority tasks

Show a short list, not all tasks.

Recommended:

- incomplete
- high priority first
- overdue before future
- due soon

Limit:

    3–5 tasks

Click opens task detail.

---

## 7. Today's schedule

Display schedule blocks for local today.

Show:

- start/end time
- title
- linked task indicator
- completion state if linked task is done

Click block can open schedule editor or linked task.

---

## 8. Upcoming deadlines

Recommended window:

- next 7 days

Exclude:

- done tasks
- tasks already shown as overdue

Sort ascending by due time.

Limit count.

Provide link:

    View Upcoming

---

## 9. Overdue section

If overdue count > 0, show a clear attention section.

Do not use alarmist styling excessively.

Show:

- task title
- how overdue
- original deadline

Action:

- complete
- open task

---

## 10. Query strategy

Avoid issuing many redundant Supabase calls.

Possible implementation:

- Today task query
- schedule range query
- upcoming query

Derive multiple widgets from shared cached data where reasonable.

If query count becomes high, consider a Supabase RPC later.

Do not prematurely build analytics tables.

---

## 11. Refresh behavior

Dashboard should update after:

- task completion
- task creation
- due date change
- schedule block change

TanStack Query invalidation should keep sections consistent.

Do not require full page reload.

---

## 12. Loading states

Use skeletons or lightweight placeholders for:

- metrics
- task list
- schedule

Avoid showing incorrect zeros before data loads.

---

## 13. Empty dashboard

If user has no tasks:

    Hôm nay chưa có công việc.
    + Tạo công việc

If no schedule:

    Chưa có lịch làm việc hôm nay.

Do not render empty chart frames.

---

## 14. Mobile/responsive behavior

Even though primary use is desktop:

- dashboard should remain usable at narrow width
- side panels can collapse
- metric cards wrap
- schedule list can become vertical

Browser extension remains separate.

---

## 15. Admin portal separation

Admin Portal should not reuse personal dashboard as an admin analytics page.

When admin is at `/admin/users`, "Cổng người dùng" returns to `/dashboard`.

Dashboard data is still admin's own personal data.

---

## 16. Suggested components

- `TodayOverviewCard`
- `CompletionProgress`
- `PriorityTasks`
- `TodaySchedule`
- `UpcomingDeadlines`
- `OverdueTasks`
- `DashboardEmptyState`

---

## 17. Tests

- no tasks
- only completed tasks
- overdue task
- due-today task
- scheduled-today task
- same task due + scheduled today counted once
- timezone day boundary
- task completion updates metrics
- admin sees only own dashboard data

---

## 18. Out of scope

- team dashboard
- admin statistics
- custom dashboard widgets
- advanced productivity scoring
- streaks/gamification
- AI recommendations

---

## 19. Definition of Done

Phase 8 is done when the dashboard accurately shows the user's current workload and updates immediately after core task/schedule actions without exposing data from any other user.
