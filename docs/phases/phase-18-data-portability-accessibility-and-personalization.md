# Phase 18 — Data Portability, Accessibility & Personalization

**Status:** Planned  
**Track:** Trust & Polish  
**Depends on:** Phases 11–17  
**Delivery:** Post-MVP enhancement — not required for Phase 10 MVP release  
**Scope rule:** Keep one shared Web auth session; preserve per-user RLS; admin may view only numerical task counts, not user task details or perform cross-user task edits.

---

## 1. Goal

Give users control over their own data and preferences, and make TabDo pleasant and inclusive for long-term daily use.

## 2. Export personal data

- Provide a user-owned export: JSON for complete portable backup and CSV for understandable task tables.
- Document schema/version, timestamp zone (ISO UTC values plus profile timezone), status, recurrence, categories, subtasks and schedule/reminder references.
- Export only data belonging to `auth.uid()`, including attachments via an intentionally authorized secure flow; don't expose privileged object paths or long-lived signed URLs.
- For large exports use paginated/streamed processing or a trusted job with owner verification. Avoid unbounded memory usage.
- Allow user to choose whether Trash and private attachments are included.

## 3. Import personal data

- First milestone: JSON import with preview, schema validation, ownership remapping and idempotent deduplication strategy.
- Map imported categories/foreign keys carefully; handle missing attachments, invalid recurrence rules and unknown schema versions.
- Clearly display a dry-run summary (new/skipped/invalid rows); require confirmation before writing.
- Use per-user RLS and safe batch sizes. Avoid importing arbitrary owner IDs/roles or privileged metadata.
- If full reversible import cannot be provided, offer pre-import backup and a clear partial-failure report.
- CSV import is optional and should not be called complete backup restoration.

## 4. Dark mode and appearance

- Add `system | light | dark` preference; default to system, persist per user if cross-device sync approved.
- Centralize design tokens, icons and contrast; test calendar events, colored category badges, modals, dropdowns and extension popup consistency.
- Respect `prefers-reduced-motion` and display-zoom/text scaling; never encode priority/status only via color.
- Avoid two completely separate duplicated CSS themes; use semantic token variables.

## 5. Accessibility baseline

- Focus/keyboard navigation for sidebar/bottom nav, Board, dialogs, calendar, notification center and global search.
- Visible focus indicators, announced errors, labels and responsive touch targets.
- Screen-reader checks for headings, statuses, counts, progress and drag alternatives.
- VI/EN localization should not overflow and must retain meaningful accessible names.

## 6. Settings and privacy

- Keep auth session model unchanged and user settings owner-only.
- Exports must not become an Admin Portal feature for accessing individual user task details; admin statistics stay counts-only.
- Download URLs should be short-lived; do not log exported personal content.
- Document data deletion/retention semantics introduced in Phase 11.

## 7. Quality and migrations

- Test import of older schema versions, corrupted JSON, duplicate tasks, missing linked IDs and recurring histories.
- Two-user RLS tests for exports and imported object references.
- Confirm accessibility with automated checks plus keyboard/screen reader manual samples.
- Test dark/light/system across Web mobile/desktop and PWA standalone.

## 8. Delivery slices

1. Export JSON + CSV with documented schema.
2. JSON preview/import and safe mapping.
3. Theme tokens and dark mode.
4. Accessibility, localization and account-preference polish.


---

## Implementation checklist (issue-ready)

- [ ] Define versioned export JSON shape and CSV task columns with timezone semantics.
- [ ] Create owner-only paginated export that can handle long histories safely.
- [ ] Define private attachment export contract (bundle/manifest) without exposing public paths.
- [ ] Implement JSON schema validation and dry-run preview for import.
- [ ] Map old IDs to new IDs in import, including subtasks/categories/recurrence/reminder relationships.
- [ ] Add idempotency/deduplication and predictable error summaries for partially successful import.
- [ ] Create semantic color token system for system/light/dark preferences.
- [ ] Check dashboard, calendar, notifications, board, modals and custom dropdowns in dark mode.
- [ ] Run accessibility keyboard/screen-reader samples and automated checks.
- [ ] Document privacy, export/download expiry and deletion semantics.

## End-to-end acceptance walkthroughs

1. **Scenario 1:** User exports tasks including recurrence and imports to a fresh account: task relations are rebuilt without assuming old `user_id`.
2. **Scenario 2:** Malformed JSON import shows validation issues without modifying database rows.
3. **Scenario 3:** Switching system theme while TabDo PWA is open updates controls without invisible status color contrasts.
4. **Scenario 4:** A keyboard-only user can create a task, filter a list and restore from Trash.

## Risks, tradeoffs and open decisions

- Risk: import creates duplicate reminders/recurrence links; **mitigation:** ID mapping and dry-run validation.
- Risk: private files shipped in export accidentally leak signed URLs; **mitigation:** short-lived authenticated download/manifest.
- Decision: CSV export supports readability, not guaranteed lossless restoration.

---

## 9. Definition of Done

- Users can safely back up and retrieve their own task data in documented formats.
- Import never grants cross-account access or silently overwrites existing data.
- Theme and accessibility improvements work across primary Web surfaces.
