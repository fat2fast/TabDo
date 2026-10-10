# Phase 16 — Global Search, Pagination, Saved Views & Templates

**Status:** Planned  
**Track:** Find & Organize UX  
**Depends on:** Phases 11–15; Phase 9 for stable metrics terminology  
**Delivery:** Post-MVP enhancement — not required for Phase 10 MVP release  
**Scope rule:** Keep one shared Web auth session; preserve per-user RLS; admin may view only numerical task counts, not user task details or perform cross-user task edits.

---

## 1. Goal

Improve navigation and retrieval after the user accumulates hundreds or thousands of tasks, while preserving current personal-data isolation.

Current baseline: `getTaskList` searches `title` only and returns up to 100 rows by default, 50 for Completed. Filters/search are already partly represented in URL query params.

## 2. Global search

- Add a unified, keyboard-accessible search entry accessible from Web header and Mobile navigation.
- Search at least title, category and plain-text description (where practical); hide internal markdown metadata comments from search snippets.
- Filters: status, priority, category, due date range, completion date range, deleted/active scope where applicable.
- Search results open the existing Task Detail deep link; never require a separate editor.
- Debounce requests, sanitize/escape PostgREST search syntax and bound query complexity; consider PostgreSQL FTS with proper indexes if simple `ilike` becomes expensive.
- The returned result set is strictly owner-scoped, with no admin access to personal content.

## 3. Pagination / infinite scroll

- Remove silent result truncation from Tasks, Board, Completed and search.
- Prefer cursor/keyset pagination for sorted feeds requiring stable ordering; for simpler cases use page-based loading with deterministic tie breakers.
- Clearly expose `Load more` or infinite loading, loading/error/end state and result count behavior.
- Avoid N+1 fetch patterns for category, subtask counts and attachment badges.
- Do not fetch every task merely to show a Board count; use scoped aggregations if necessary.
- Reset or preserve pagination intentionally when filters or sorts change.

## 4. Saved views

- Users can name/save a safe serializable combination of filters, sort, view type and layout.
- Possible schema: `saved_task_views (id, user_id, name, definition jsonb, sort_order, created_at, updated_at)` with per-user RLS, schema validation and reasonable count/length caps.
- User can pin, rename, reorder and delete saved views; default system views stay available.
- Saved views must not contain auth secrets, raw SQL, arbitrary expressions or cross-user references.
- Mobile and desktop use the same saved definitions, with graceful fallback if layout is unavailable.

## 5. Task templates (optional slice)

- Optional create-from-template flow with title, description/checklist, priority, category and relative reminder preferences.
- Do not copy existing file attachments or private signed URLs into templates automatically.
- Keep templates personal (`user_id`) with RLS; store only safe serializable fields.
- If schedule defaults are offered, calculate new absolute times at creation in profile timezone.
- It is acceptable to defer templates to Phase 20 if Phase 16 becomes too large.

## 6. Performance and security

- Query performance budget established from measured UAT fixtures; add indexes based on EXPLAIN and realistic load.
- RLS tested for search/saved views/templates; storage of arbitrary JSON validated on server/DB boundary.
- Ensure virtualized long lists preserve keyboard navigation and accessible result reading.
- Do not index file contents or other app providers' data in this phase.

## 7. Milestones

1. Search API/data contract, result presentation, deep links.
2. Pagination across core views and Board.
3. Saved-view persistence and UI.
4. Optional templates and usage feedback.
5. Load tests, accessibility and docs.


---

## Implementation checklist (issue-ready)

- [ ] Design query contract for Global Search and shared search results; document searchable fields.
- [ ] Implement server-side search with properly escaped terms and RLS; add indexes based on explain plans.
- [ ] Add keyboard-accessible global search launcher and recent/favorite actions only with permission.
- [ ] Replace silent 50/100-row limits using pagination for task lists, Completed and Board lanes.
- [ ] Implement stable query keys/cursors and reload-on-filter semantics.
- [ ] Define `saved_task_views` versioned JSON schema and owner RLS before UI saves arbitrary definitions.
- [ ] Create saved-view pin/rename/reorder/delete UX with clear default system views.
- [ ] Build task template draft/preview flow as optional, ensuring no raw attachment blobs copy.
- [ ] Test large datasets for query count, deep links and no cross-user result leakage.
- [ ] Support VI/EN status, priority and search-result labels in saved filters.

## End-to-end acceptance walkthroughs

1. **Scenario 1:** User with 700 completed tasks can find a task beyond the previously loaded first 50, without manual date guessing.
2. **Scenario 2:** Saved “High priority this week” filter is available after logout/login on the same account and not visible to other account.
3. **Scenario 3:** Pagination continues after changing sort without skipped/repeated rows, or restarts clearly from page one.
4. **Scenario 4:** Template created from a recurring task does not copy its exact historical due date or signed attachment links.

## Risks, tradeoffs and open decisions

- Risk: full text search on raw HTML metadata yields confusing results; **mitigation:** search clean normalized text/snippets.
- Risk: global counts require loading all rows; **mitigation:** indexed scoped aggregate query.
- Decision: templates can be postponed until Phase 20 without blocking search/saved views.

---

## 8. Definition of Done

- User can find an old task without relying on arbitrary 50/100-item limits.
- Search and filters are fast enough on meaningful UAT-sized datasets.
- Saved views restore reliably across devices, and only the owning user can access them.
- Existing list/board navigation remains consistent.
