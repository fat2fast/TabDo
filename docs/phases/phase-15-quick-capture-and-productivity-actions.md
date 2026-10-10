# Phase 15 — Quick Capture, Bulk Actions & Faster Task Interactions

**Status:** Planned  
**Track:** Everyday Workflow UX  
**Depends on:** Phases 11–14; existing task/reminder APIs  
**Delivery:** Post-MVP enhancement — not required for Phase 10 MVP release  
**Scope rule:** Keep one shared Web auth session; preserve per-user RLS; admin may view only numerical task counts, not user task details or perform cross-user task edits.

---

## 1. Goal

Reduce the number of clicks required to capture, organize and act on tasks across Web, Mobile Web and Browser Extension without adding new business domains.

## 2. Unified Quick Add behavior

- Standard quick mode captures a title with one action; optional expansion adds due date/time, priority, category and reminder.
- Use a shared domain validation contract for Web/Extension, not duplicated ad hoc validation.
- Extension popup currently accepts title only: extend *optional* properties while keeping title-only save as the default.
- If task is created from selected page text, display an editable review before submission and attach source URL only after the user explicitly activates the feature (least-privilege `activeTab`/context-menu model).
- No automatic page scraping, permissions to all sites, or silent capture of private content.
- Handle create-task succeeded / add-reminder failed as an explicit partial-success state with a retry path; no false all-or-nothing success.

## 3. Contextual quick actions

- On desktop task rows and Board cards: change priority/status, set due date, schedule work, snooze reminder, duplicate where justified.
- On mobile: a visible overflow menu and optional carefully designed swipe actions. Avoid hover-only affordances.
- For completion of recurring tasks, use the atomic completion RPC; do not update status directly.
- For rescheduling, distinguish *task deadline* from *calendar work block* in labels and confirmations.

## 4. Bulk actions

- Provide selection mode in List View (optionally Board later): select all visible, clear, filtered selection count.
- Supported initial actions: set priority, change category, move between todo/in-progress, soft-delete to Trash, and Complete with proper per-task lifecycle.
- Bulk status change to `done` for recurring tasks invokes completion RPC per task with expected `updated_at`. Do not bypass sequence logic or promise atomic batch completion unless a transactional backend batch RPC exists.
- Batch UI reports per-item success/failure and supports retry of failed items; avoid triggering a storm of unbounded concurrent requests.
- Do not allow cross-owner task IDs or hard deletion without explicit separate confirmation.

## 5. Undo and feedback

- Consistent toasts with action outcome, optimistic pending state and clear conflict messages.
- Undo is offered only for **genuinely reversible actions** with verified server state. A cosmetic toast is not undo.
- Trash move can offer Restore; other actions need inverse mutation or short-lived transactional compensation policy.
- Do not offer one-click undo for a completed recurring occurrence after it spawned a successor unless safe reopen/reversal behavior is explicitly implemented.
- Handle offline/error distinctly from success; keep error messages localized (VI/EN).

## 6. Keyboard productivity

- Basic shortcuts: focus search, open Quick Add, navigate Tasks/Today, Escape to close overlays.
- Prevent shortcut interception inside inputs, editors, dialogs or assistive-tech contexts; support configuration/help overlay.
- Optional command palette can list navigation and safe create/open actions; defer complex natural-language date parsing and arbitrary scripting.
- Provide accessible labels and no keyboard-only critical tasks.

## 7. Cross-client consistency

- Web and Extension produce the same task constraints, timezone conversion and invalidation/sync behavior.
- Updating reminder/task on Web should reconcile Extension alarms at the next available sync; document timing limits.
- On-demand content injection from the browser extension remains an explicit security constraint and should be tested here if not already implemented.

## 8. Suggested slices

1. Quick Add shared contract and extension optional fields.
2. Web/mobile contextual actions.
3. Selection mode + safe bulk mutation pipeline.
4. Undo/toast/error system.
5. Shortcuts/command palette entry points.


---

## Implementation checklist (issue-ready)

- [ ] Inventory Quick Add pathways: Tasks, Dashboard, Extension Popup, selected-text content script.
- [ ] Agree one shared validation/field schema and consistent error messages across clients.
- [ ] Refactor extension on-demand injection and request only necessary permissions before improving selection UX.
- [ ] Implement optional due/category/priority/reminder in Extension Popup behind a secondary disclosure.
- [ ] Implement mobile and desktop context actions without hover dependencies.
- [ ] Add bulk selection state to List and implement bounded sequential/concurrent mutations.
- [ ] Handle recurrent Done via RPC per selected task and record partial successes.
- [ ] Implement actual reversible Undo for Trash move; do not promise undo for irreversible actions.
- [ ] Add shortcut help and field-focus exclusions; test screen readers and editable Markdown areas.
- [ ] Reconcile task/reminder alarms after Extension mutations.

## End-to-end acceptance walkthroughs

1. **Scenario 1:** Selected-text context menu populates a review dialog only after explicit user click; cancel sends no content to Supabase.
2. **Scenario 2:** User creates a task and chooses reminder; reminder save fails: UI reports task created but reminder failed, with retry.
3. **Scenario 3:** User selects 15 mixed tasks for completion including recurrence; each task completes correctly with idempotent successors and per-row error feedback.
4. **Scenario 4:** Keyboard shortcut to Quick Add is ignored while typing in description editor and closes safely using Escape.

## Risks, tradeoffs and open decisions

- Risk: selected-text capture leaks page details; **mitigation:** action-triggered capture, minimal URL/text and explicit review.
- Risk: concurrent bulk requests race on timestamps; **mitigation:** bounded requests and item-level optimistic concurrency.
- Decision: NLP quick-entry syntax (“tomorrow 9am”) remains out of scope.

---

## 9. Tests and DoD

- Title-only and detailed Quick Add; invalid timezone/due combinations; duplicate submits.
- Selected-text creation never runs without user action and handles restricted pages.
- Bulk operation handles mixed recurring/nonrecurring tasks and partial errors.
- No ghost reminders or duplicate successors after rapid actions.
- Keyboard shortcuts do not fire while typing; screen reader users can activate same commands.
- **Done** when frequent task actions take fewer steps without compromising correctness or accessibility.
