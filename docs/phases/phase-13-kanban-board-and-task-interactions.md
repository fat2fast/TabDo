# Phase 13 — Kanban Board & Status Interaction UX

**Status:** Planned  
**Track:** UX Core  
**Depends on:** Phases 2, 7, 10, 12  
**Delivery:** Post-MVP enhancement — not required for Phase 10 MVP release  
**Scope rule:** Keep one shared Web auth session; preserve per-user RLS; admin may view only numerical task counts, not user task details or perform cross-user task edits.

---

## 1. Goal

Introduce a Kanban-like **Board view** for the existing personal Tasks workspace. Keep List and Board as two presentations of the same data, queries and domain mutations.

Current baseline: List/Smart Views exist, `todo|in_progress|done` is the canonical status model, and recurrence completion uses an atomic RPC. Do not add `overdue` as a persisted column or a separate task entity.

## 2. Board model and route/state

- Add `List | Board` toggle on the Tasks page, retaining currently applied search/filter/category/scope settings.
- Persist presentation mode in URL query (`?layout=board`) or a documented per-user preference; back/refresh should preserve selection.
- Three fixed columns: To do, In progress, Done. Show counts computed from the *filtered result set*; document if counts are paginated.
- On narrow screens, show one column at a time or status tabs plus a card list. Avoid three squeezed desktop columns.
- Card includes: title, category, priority, due date/overdue indication, recurrence badge, checklist/subtask progress where already available.
- Click card opens existing Task Detail route/drawer. Never fork the task editor for Board.

## 3. Queries and scale

- Reuse shared task list queries but explicitly implement an all-status Board query; existing 'inbox' and 'completed' filters alone are insufficient.
- Keep server-side RLS and owner-scoped filters.
- Do not accidentally turn an existing 100-row cap into a silent, incomplete board. Choose pagination/load-more per column or another bounded data strategy before release.
- TanStack Query keys should include layout-independent filters; invalidate/refetch after changes; avoid redundant fetches per card.

## 4. Desktop drag and drop

- Drag card to another status column; show drop target, pending state and accessible feedback.
- For `todo <-> in_progress`, use the standard owner-scoped task update path and handle optimistic concurrency errors.
- For `todo|in_progress -> done`, **always** call `complete_task_and_generate_next` with expected `updated_at` and display the generated successor where appropriate.
- For `done -> active`, honor recurring-task reopen constraints, especially when a successor already exists. Show a clear reason if blocked.
- On failed server mutation, restore original card position and announce error, never leave a misleading UI state.
- Support non-drag controls (menu/keyboard) to move card status; drag and drop must never be the only workflow.

## 5. Mobile interactions

- Use status segment/tabs to select a lane; cards are touch-friendly with explicit Change Status action.
- Optional swipe actions only if discoverable and non-destructive; do not substitute swipe for visible controls.
- On drag-capable devices avoid conflicts with vertical scrolling and native page gestures.
- Use an accessible status select/menu instead of native unstyled `<select>` per current project UI rules.

## 6. Future-safe boundaries

- No custom statuses, custom columns, WIP limits, swimlanes, cross-user assignments or board sharing in this phase.
- Board ordering is optional: implement explicit `sort_rank` only if persistent manual ordering is approved. Do not infer position from incidental client array order.
- Trash/deleted tasks are excluded and may not be resurrected by moving cards.

## 7. Testing and quality

- Move between To do and In progress; multiple rapid transitions.
- Complete recurring task twice/race; exactly one successor; no duplicate audit log.
- Reject blocked reopen of recurring source; correct toast/dialog and rollback.
- Cross-user update rejected even when task ID is guessed.
- Switching List↔Board retains filters and selected task deep link.
- Mobile status menu, keyboard drag alternative, screen-reader column and live status feedback.
- Column pagination/load-more, no missing rows.

## 8. Suggested implementation slices

1. Board query/data contract and route toggle.
2. Read-only columns/cards, mobile single-lane view.
3. Accessible status controls and mutation paths.
4. Desktop drag/drop with error rollback.
5. Tests and performance validation.


---

## Implementation checklist (issue-ready)

- [ ] Separate presentation layout state from task view/status semantics; ensure URL serializes both.
- [ ] Implement bounded all-status Board data query instead of recycling inbox-only filter.
- [ ] Create three accessible lanes and cards with existing task metadata visual rules.
- [ ] Define server counts and pagination behavior when filtered total exceeds page size.
- [ ] Implement status-change command using one shared pathway, not independent Board mutation logic.
- [ ] Route Done through atomic recurrence RPC with optimistic concurrency.
- [ ] Handle blocked reopen/failed drag with rollback and explicit alert.
- [ ] Add accessible non-drag status menu and a touch-first lane selector.
- [ ] Unit test Board filters, card counts, key/ARIA labels, status commands, and error rollback.
- [ ] Review performance under realistic number of cards and reduced motion.

## End-to-end acceptance walkthroughs

1. **Scenario 1:** A user filters high-priority tasks, switches List to Board and reloads: same filter remains and only matching cards show.
2. **Scenario 2:** User drags recurring task to Done twice quickly: only one successor is created; next task appears via invalidated query.
3. **Scenario 3:** User tries to move old recurring completion back to Todo: server rejects and card returns to Done with explanation.
4. **Scenario 4:** On a phone, user changes a task from Todo to In Progress using a menu without dragging.

## Risks, tradeoffs and open decisions

- Risk: count mismatch due to partial results; **mitigation:** server-scoped counts or clear loaded-item labels.
- Risk: drag-and-drop relies on pointer-only input; **mitigation:** keyboard/menu action parity.
- Decision: persistent manual card ordering is deferred unless a validated `sort_rank` design is approved.

---

## 9. Definition of Done

- Personal tasks can be viewed and managed by status in List or Board.
- Desktop drag/drop and accessible alternative invoke the correct existing completion lifecycle.
- Board works on phones without sideways page overflow.
- Owner RLS and recurrence idempotency are preserved.
