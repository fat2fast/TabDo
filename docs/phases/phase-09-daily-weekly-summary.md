# Phase 9 — Daily & Weekly Summary

**Status:** Planned  
**Depends on:** Phases 2, 3, 8  
**Benefits from:** Phase 7 activity history

## 1. Goal

Help users review outcomes instead of only planning future work.

MVP summaries are deterministic and data-driven.

AI is explicitly not required.

---

## 2. Route

    /summary

Suggested tabs:

- Daily
- Weekly

Optional query:

    /summary?period=daily
    /summary?period=weekly

---

## 3. Daily summary

Show for selected local date:

- planned/relevant tasks
- completed tasks
- pending tasks
- overdue tasks
- completion rate

Sections:

- Completed
- Carry over
- Overdue

Allow selecting previous days if simple.

---

## 4. Definition of "planned"

This metric must be consistent.

Recommended:

A task is planned for a day if it was:

- due that day, or
- scheduled that day

A task may be counted once even if both.

If activity history allows, include tasks that were scheduled/due then later moved. For MVP, current-state reconstruction may be imperfect.

Document this limitation.

---

## 5. Completed metric

Prefer:

    completed_at within selected local day

This answers what the user actually finished that day.

Do not infer completion from current status alone without `completed_at`.

---

## 6. Carry over

Recommended definition:

A task relevant to the selected day that remained incomplete after day end and was not deleted.

For current-day summary:

- currently incomplete relevant tasks

For historical days, accurate carry-over may require activity history.

If exact historical reconstruction is not available, clearly define the MVP approximation.

---

## 7. Weekly summary

Show:

- tasks completed
- completion rate
- overdue count
- most productive day
- tasks by category
- optional comparison vs previous week

Week:

    Monday → Sunday

Use profile timezone.

---

## 8. Most productive day

Simple MVP metric:

    day with highest completed task count

Tie behavior:

- show first tied day, or
- show all tied days

Document it.

Do not create a subjective "productivity score" yet.

---

## 9. Category breakdown

Count completed tasks by category.

Handle:

- deleted category
- uncategorized tasks

Display:

    Uncategorized

rather than dropping them.

---

## 10. Previous-week comparison

Optional but useful.

Metrics:

- completion count
- completion rate

Example:

    81% this week
    74% previous week
    +7 percentage points

Be precise whether showing percent change or percentage-point difference.

Use percentage points for completion rate comparison.

---

## 11. Activity data

Use:

- tasks
- completed_at
- task_activities

`task_activities` is especially useful for:

- completion events
- reopen events
- deadline changes

Do not introduce an event warehouse.

---

## 12. Query strategy

For selected period:

- bound queries by time
- avoid loading full task history

Daily:

    start_of_day → end_of_day

Weekly:

    start_of_week → end_of_week

Use server/database aggregate queries later if client aggregation becomes inefficient.

---

## 13. Historical correctness limitations

MVP may not perfectly reconstruct:

- a task's previous category after category changed
- a due date that was moved later
- deleted tasks if hard-deleted
- schedule blocks deleted later

If historical accuracy is a product requirement, Phase 10 may introduce stronger event snapshots or soft deletion.

For initial personal MVP, document approximation clearly.

---

## 14. Visualization

Keep visualizations simple:

- completion progress
- small bar chart for completed by day
- category breakdown

Do not overbuild analytics.

A table/list is acceptable if clearer.

---

## 15. Daily review action

Optional useful action:

    Move pending tasks to tomorrow

But this can blur due date vs schedule.

If implemented, explicitly ask whether to:

- reschedule work time
- change deadline

Do not silently move deadlines.

This feature may be deferred.

---

## 16. AI summary

Not part of MVP.

Future:

    "You completed 26 of 32 planned tasks this week..."

AI should summarize deterministic metrics rather than invent them.

---

## 17. Suggested components

- `SummaryPage`
- `DailySummary`
- `WeeklySummary`
- `CompletionMetric`
- `CompletedList`
- `CarryOverList`
- `OverdueSummary`
- `WeeklyCompletionChart`
- `CategoryBreakdown`

---

## 18. Tests

- day with no tasks
- completion at local midnight boundary
- reopened task
- overdue task
- uncategorized task
- weekly Monday/Sunday boundaries
- previous-week comparison
- admin sees only own summary

---

## 19. Out of scope

- team analytics
- admin analytics
- productivity score
- gamification
- AI insight
- forecasting
- billing/usage analytics

---

## 20. Definition of Done

Phase 9 is done when users can review daily and weekly output using understandable, documented metrics derived from their own task/activity data.
