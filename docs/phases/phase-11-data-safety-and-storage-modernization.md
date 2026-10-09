# Phase 11 — Data Safety, Trash & Storage Modernization

**Status:** Planned  
**Track:** Post-MVP Core Reliability  
**Depends on:** Phase 10; can be prioritized as a critical pre-release fix if required  
**Delivery:** Post-MVP enhancement — not required for Phase 10 MVP release  
**Scope rule:** Keep one shared Web auth session; preserve per-user RLS; admin may view only numerical task counts, not user task details or perform cross-user task edits.

---

## 1. Goal

Eliminate avoidable permanent data loss and stop storing file bytes inside task descriptions. Establish a reliable ownership-safe foundation for richer UX without rewriting the full task domain.

**Why this phase exists:** current `deleteTask` hard-deletes rows, with dependent cascading deletes, while attachments are Base64 Data URLs embedded in `tasks.description` comments. Linked task IDs and checklist metadata are also stored in description comments. These designs are workable for prototyping but fragile at scale.

## 2. Scope and boundaries

**In scope:** Trash, restore, deliberate permanent deletion, private file storage, metadata integrity, migration of existing embedded attachments, link/checklist compatibility, extension/dashboard/reminder handling of deleted tasks.

**Out of scope:** team-shared files, public sharing, advanced version history, collaborative editing, automated billing/storage quotas, general-purpose document management.

No admin may browse, download, or delete another user's files or tasks. The agreed admin statistics API returns counts only.

## 3. Trash lifecycle (deliverable A)

- Add `tasks.deleted_at timestamptz null`; if necessary add `deleted_by`, or a lightweight deletion event to `task_activities`.
- Normal views and queries exclude deleted tasks by default. `Trash` explicitly queries only the current user's deleted tasks.
- Soft-deleting a parent must not silently expose subtasks as normal tasks. Define consistent parent-child deletion and restore behavior; prefer a transactional owned RPC for cascaded state changes.
- Soft-deleting a recurring occurrence must not generate a successor or alter completed history; document behavior for deletion of a whole series vs one occurrence.
- Do not physically delete schedule blocks or reminders during the reversible stage. Ensure deleted-task reminders are ignored/disabled and Extension alarms are reconciled immediately or on next sync. Consider an owned, atomic delete RPC if multiple tables change.
- Restore preserves prior status/deadline/category where valid, but validates all ownership references and reconciles reminders only when they should remain active.
- Permanent delete is a separate, irreversible confirmation action. Define retention policy (for example 30 days) *as a product decision*; do not claim automatic purge unless a trusted job is implemented.

### Proposed interfaces

- `apps/web/src/features/tasks/components/task-trash.tsx` or dedicated `/tasks/trash` route.
- `softDeleteTask`, `restoreTask`, `permanentlyDeleteTask` with mutation hooks and query invalidation.
- A clear `Moved to Trash` toast with Restore action where safe.
- `packages/supabase` helpers only if also consumed by Extension.

## 4. Private attachment storage (deliverable B)

**Target data boundary:** private Supabase Storage bucket and user-owned metadata.

Possible schema (design proposal, not migration-ready SQL):

```text
task_attachments
  id uuid PK
  user_id uuid NOT NULL
  task_id uuid NOT NULL
  bucket text NOT NULL
  object_path text NOT NULL
  file_name text NOT NULL
  mime_type text
  byte_size bigint NOT NULL
  created_at timestamptz NOT NULL
```

- Objects use opaque identifiers; optionally prefix paths with the authenticated user ID. Do not rely on client-supplied path segments alone for security.
- Enforce row ownership and task ownership with RLS plus database validation. Storage policies must restrict upload/read/remove to the owner; use authenticated short-lived signed URLs if appropriate.
- Avoid public buckets, service-role keys in clients, and embedding file contents or signed URLs permanently in task descriptions.
- Validate file size and allowed content types server/storage-side where possible; display errors and upload progress; prevent orphan objects when DB insert fails.
- On task hard deletion, delete file metadata and storage objects through a controlled cleanup path; design retry for partial failures.

## 5. Migration from description metadata

Current embedded comments include `tabdo_attachments`, `tabdo_checklist`, and `tabdo_linked`. Preserve backward compatibility during rollout.

1. Inspect actual data shapes and content limits in a non-production copy.
2. Provide an idempotent migration/backfill routine for Base64 objects. Verify checksums and attach the stored path to the correct owner/task.
3. Preserve original description until verification and rollback window end; avoid destructive rewrite before confirming migration.
4. Replace active attachment reads/writes with normalized metadata; keep a temporary legacy reader only where needed.
5. Determine whether linked tasks/checklists require dedicated tables now or a separately scheduled normalization. At minimum, centralize the metadata codec and regression-test that editing markdown never leaks, duplicates, or corrupts metadata.
6. Recurring successor creation must **not** clone encoded file bytes into the next occurrence. Explicitly decide whether to reference existing attachments or start with none; default to no implicit file copying.

## 6. Query, UX and cross-client behavior

- Inbox, Today, Upcoming, Overdue, Board, Calendar, Dashboard and Summary omit trashed task content unless a historic metric explicitly requires it.
- `Trash` offers search, restore, permanent delete and empty state; on mobile use full-screen layout.
- Deep links to deleted tasks show a safe, owner-only unavailable/restore explanation instead of a crash.
- Extension Today's task list skips trashed rows, ignores associated alarms, and removes stale local notifications after sync.
- Historical summary behavior for deleted tasks must be defined carefully; do not silently change historical completion metrics.

## 7. Verification and security

- User A cannot list, restore, purge, or download User B data; admin cannot do so either through normal client endpoints.
- Parent/subtask restore, recurrence chain, active reminders, deleted categories, missing files and network failures.
- Attachment upload/remove rollback and retry; deny path traversal/cross-user object references.
- Existing legacy metadata remains readable until safely migrated; no unbounded payloads in API responses.
- After restoring a task, no ghost alarms or duplicate next recurring occurrence.

## 8. Suggested implementation slices

1. Define deletion semantics and write schema/RLS migration and tests.
2. Implement soft-delete/restore/purge API and Trash UI.
3. Reconcile reminders, extension and summaries.
4. Create private bucket and attachment metadata with ownership tests.
5. Add staged migration and dual-read compatibility; switch uploads to Storage.
6. Remove legacy attachment writes only after migration verification.


---

## Implementation checklist (issue-ready)

- [ ] Document the exact existing hard-delete call sites and foreign-key cascade effects before choosing the soft-delete mechanism.
- [ ] Create `deleted_at` migration, indexes for active/trash queries, and non-null ownership constraints.
- [ ] Review whether all existing RLS/queries need explicit `deleted_at is null` predicates; never rely on UI filtering alone for data invariants.
- [ ] Implement reversible parent/subtask behavior atomically; test detached schedule blocks and inherited reminder outcomes.
- [ ] Add Trash navigation and owner-only actions across desktop/mobile; include retention message.
- [ ] Add a private Storage bucket and object/key naming contract; forbid public object URLs.
- [ ] Ship migration tooling with a dry-run mode and per-item audit of migrated Base64 files.
- [ ] Update recurrence successor creation so description metadata cannot duplicate binary payloads.
- [ ] Define how summary historical counts handle restored/deleted tasks before changing source queries.
- [ ] Add a migration rollout/rollback note; never rewrite previously applied migrations.

## End-to-end acceptance walkthroughs

1. **Scenario 1:** User deletes a task with subtasks/reminders: active lists lose task; no alarm fires; Trash shows recoverable task; Restore returns consistent descendants.
2. **Scenario 2:** User attaches a file and reloads a different device: authorized owner can access it, other user cannot access object or metadata.
3. **Scenario 3:** Migration encounters malformed embedded attachment metadata: original description preserved and error logged without losing the task.
4. **Scenario 4:** User permanently deletes task with files: cleanup is attempted and retryable; UI never claims retained file was purged unless confirmed.

## Risks, tradeoffs and open decisions

- Risk: cascading deletes from existing FK relationships during migration; **mitigation:** use new forward migration and test against representative UAT clone.
- Risk: temporary dual-read causes duplicate attachments; **mitigation:** deterministic legacy ID mapping and idempotency records.
- Decision: 30-day retention is illustrative; confirm product retention and automatic purge mechanism separately.

---

## 9. Definition of Done

- A user can remove and restore a task without data loss.
- Permanent deletion is explicit, owned and irreversible by design.
- Files are no longer newly embedded as Base64 in `tasks.description`.
- Existing supported attachments are migrated or remain safely readable during a documented transition.
- RLS and Storage rules prevent cross-account access.
- Extension, Dashboard, Summary and recurring task flows remain consistent.
