# Phase 20 — Focus Mode, Task Templates & Personal Workflow Enhancements

**Status:** Planned  
**Track:** Optional Post-MVP Product  
**Depends on:** Phases 12–18; Phase 19 optional  
**Delivery:** Post-MVP enhancement — not required for Phase 10 MVP release  
**Scope rule:** Keep one shared Web auth session; preserve per-user RLS; admin may view only numerical task counts, not user task details or perform cross-user task edits.

---

## 1. Goal

Extend TabDo from planning into *doing*: a lightweight focus workflow that stays closely tied to an existing personal task rather than becoming a separate timer product.

## 2. Focus session UX

- Start/stop a focus session from Task Detail, Board card or Today view.
- Focus screen shows one selected task, its checklist, a timer and a clear Exit action; do not hide essential accessibility features or emergency escape routes.
- Provide optional 25/5 Pomodoro preset, plus custom duration. Timer must handle page suspension, tab switching and device sleep using elapsed timestamps rather than interval ticks alone.
- Users can complete checklist items and the task from Focus Mode through existing mutation paths; recurring completion still uses atomic RPC.
- Do not create pressure-inducing streaks, rankings or compulsive notifications.

## 3. Data model and reporting

- Initial focus mode may be ephemeral/local-only with no historical tracking.
- If time tracking is approved, introduce owner-scoped `focus_sessions` with `task_id`, `started_at`, `ended_at`, `duration_seconds` and explicit privacy/retention rules.
- Define interrupted/abandoned sessions and whether pauses count. Do not automatically claim time worked based on scheduled block duration.
- Focus metrics can complement Summary after their semantics are documented, but never replace task-completion metrics.
- Admin gets no per-user focus details; numerical aggregates require separate explicit scope approval.

## 4. Personal workflow aids

- Revisit optional task templates from Phase 16: 'weekly report', 'invoice review', 'meeting preparation', etc., with reusable checklist and priority presets.
- Optional 'My Day' planning assistant can **suggest** candidate tasks based on deadline/priority; must never silently change deadline, schedule or priority.
- Provide per-user preference for default task view (List vs Board), startup route and whether to show completed items.
- No AI agent, background auto-scheduling, team assignment or external integrations by default.

## 5. Desktop, mobile and PWA details

- Maintain a readable full-screen focus layout on mobile with safe-area-aware controls.
- Ensure timer state survives ordinary route navigation and refresh if persistence is explicitly supported; otherwise clearly warn when leaving.
- On battery-saving/suspended browsers, reconcile elapsed time on resume. Offline timers are local UI, not confirmed task activity until synchronized.
- Keyboard shortcuts and reduced-motion settings should apply.

## 6. Tests

- Pause/resume and refresh; timer drift after device sleep.
- Focus task deleted/trashed; completed recurring task; lost session; browser closed.
- Cross-user security on `focus_sessions` if stored; task ownership and reminder isolation.
- Accessible exit controls, mobile screen-reader/keyboard behavior.

## 7. Out of scope / future backlog

- Google Calendar/Tasks two-way integration, Gmail, Slack and Microsoft 365 require separate provider security/token lifecycle projects and should only receive dedicated phase docs after user demand.
- Native mobile and collaboration are separate architectural initiatives, not silent additions to these enhancement phases.
- AI automatic task generation and gamification are not in this phase.


---

## Implementation checklist (issue-ready)

- [ ] Prototype an accessible Focus Mode route/dialog without adding a new backend table initially.
- [ ] Define timer source-of-truth as start/end instants and paused intervals rather than interval ticks.
- [ ] Keep clear navigation, stop and task-complete actions on all viewport sizes.
- [ ] Route task completion through existing RPC and show blocked recurrence reopen feedback.
- [ ] Decide if focus session history is needed; if yes, design per-user RLS and privacy retention.
- [ ] Implement optional task templates/presets only if Phase 16 deferred them.
- [ ] If implementing task suggestions, make them read-only suggestions until explicitly accepted.
- [ ] Integrate reduced-motion, VI/EN strings and mobile safe area.
- [ ] Test app suspension/resume, tab refresh, DST/timezone and deletes during session.
- [ ] Document objective measures before introducing streaks or productivity scores.

## End-to-end acceptance walkthroughs

1. **Scenario 1:** User focuses a task for 25 minutes, switches tabs, returns and timer reflects elapsed time rather than a paused JavaScript interval.
2. **Scenario 2:** Recurring task completed during focus generates one next occurrence; focus session attaches to completed source occurrence.
3. **Scenario 3:** Task is moved to Trash while focus is running: focus UI stops or prompts safely and does not re-create deleted task.
4. **Scenario 4:** A user on a screen reader can pause, resume and exit Focus Mode without hidden controls.

## Risks, tradeoffs and open decisions

- Risk: timer app grows into an unrelated time-tracking suite; **mitigation:** task-tied MVP, no automatic payroll/productivity claims.
- Risk: session logs add sensitive behavioral metadata; **mitigation:** opt-in collection and owner-only access.
- Decision: Phase 20 is optional pending evidence that focus sessions improve task completion UX.

---

## 8. Definition of Done

- User can enter and leave a focused task session without losing task state.
- Session timing is accurate across tab suspension within documented tolerances.
- No background activity is inferred without consent; personal focus data remains owner-only.
- Templates/preferences (if delivered) remain consistent with existing task and timezone contracts.
