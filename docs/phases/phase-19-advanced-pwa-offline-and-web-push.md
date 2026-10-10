# Phase 19 — Advanced PWA: Offline Sync, Web Push & Share Target

**Status:** Planned  
**Track:** Optional Post-MVP Infrastructure  
**Depends on:** Phases 11, 12, 14, 15, 18; only after real demand  
**Delivery:** Post-MVP enhancement — not required for Phase 10 MVP release  
**Scope rule:** Keep one shared Web auth session; preserve per-user RLS; admin may view only numerical task counts, not user task details or perform cross-user task edits.

---

## 1. Goal

Add mobile capabilities **only when the cost is justified**: offline personal-task access and mutation synchronization, server-backed Web Push reminders, and optional share-to-TabDo entry points.

This phase is intentionally deferred. **Installable PWA (Phase 14) must not be represented as full offline support or push support.**

## 2. Offline read and data isolation

- Use an explicit per-user cache (e.g. IndexedDB) for a bounded Today/Upcoming subset; use a schema version and expiry metadata.
- Define what is readable offline, how long it remains valid, and when stale data is visibly labeled.
- Auth expiry/account deactivation/logout removes or locks user-specific offline data; never show the previous account's tasks to another account.
- Consider browser-at-rest privacy: shared-device scenarios and local DB exposure.
- Do not cache secret keys, bearer tokens in general-purpose data stores, or raw private attachment objects without explicit controls.

## 3. Offline mutations and conflict resolution

- Begin with narrowly scoped operations (for example creating a simple nonrecurring task); queue with stable client-generated idempotency keys.
- Define state machine: queued → syncing → synced / conflict / failed; show outcome to user.
- Reconcile across multiple devices/tabs and preserve server authoritative IDs.
- **Do not enqueue recurring completion or reminder snooze naively.** These operations require expected timestamps, atomic server RPC, and conflict handling; defer until an end-to-end protocol is proven.
- Never claim a queued offline operation has already been persisted remotely.

## 4. Web Push for reminders

- Design a trusted backend scheduler/dispatcher (Supabase scheduled function or suitable job runner), push subscription storage with per-user RLS, delivery retries and deduplication keys.
- Choose push protocol/service and validate platform support; on supported iOS versions web push often requires installed PWA and granted permission; behavior varies by OS/browser.
- Treat notification as best effort, not a guaranteed real-time alarm; track server send and client receipt separately.
- Ensure user-controlled opt-in/opt-out, quiet hours/timezone and device subscription revocation.
- Avoid double-notification with Chrome Extension on desktop: dedupe strategy, preference per device, and consistent reminder status lifecycle.
- Never place sensitive full task content in push payloads unless the user explicitly chooses it; use deep links with auth validation.

## 5. Share Target and incoming capture (optional)

- Allow explicit OS share-to-TabDo (URL/title/selected text) where browser supports Web Share Target; show confirm/edit screen before saving.
- Validate content length and URLs, prevent injection, do not automatically read unrelated app data.
- Keep scoped feature detection and fallback manual Quick Add.

## 6. Technical boundaries and costs

- Vercel remains frontend hosting; backend dispatcher operates in a trusted scheduled environment, not inside a static client.
- Analyze job frequency, failed delivery, quotas, storage, retention and privacy disclosures before launch.
- Keep extension notification machinery independent; no broad site permissions reintroduced.

## 7. Validation scenarios

- Offline create → reconnect once, no duplicates; conflict/multiple device; session expiry/logout while queue pending.
- Offline stale cache never crosses account boundary.
- Push permission denied, subscription expired, browser closed, device offline, device clock/timezone changed.
- User with both extension and PWA enabled does not receive uncontrolled duplicate alerts.
- Data-loss and failed-sync simulation; rollback/off switch for push dispatch.


---

## Implementation checklist (issue-ready)

- [ ] Document exact offline supported commands and prohibited flows before enabling cache.
- [ ] Design per-user IndexedDB schema, retention, purge and recovery.
- [ ] Use stable local mutation IDs and authoritative reconciliation against Supabase.
- [ ] Implement one low-risk offline mutation end to end before supporting more.
- [ ] Define conflict UI and test across two tabs/devices before enabling queued edits.
- [ ] Plan trusted scheduler/push worker with quota/cost forecast and metrics.
- [ ] Use push subscription registration/revocation with account RLS and device scoping.
- [ ] Implement push payload minimization, opt-in, quiet hours and deduplication with Extension notifications.
- [ ] Test browser/OS permission matrix and background/installed PWA behavior with real devices.
- [ ] Add clear feature flags and rollback controls for offline writes and push.

## End-to-end acceptance walkthroughs

1. **Scenario 1:** A queued offline simple task is sent exactly once on reconnect, even after service-worker restart.
2. **Scenario 2:** User logs out while offline queue has pending entries: the next account never sees prior account data or mutations.
3. **Scenario 3:** A reminder scheduled while browser is closed is delivered on a supported subscribed device best-effort without double-alert from Extension.
4. **Scenario 4:** User disables web push: server stops sending to removed device subscription and revocation is reflected in UI.

## Risks, tradeoffs and open decisions

- Risk: OS may delay or suppress push; **mitigation:** honest best-effort semantics and reminder history.
- Risk: offline writes cause recurrence duplication; **mitigation:** defer recurrence completion until conflict protocol supports RPC semantics.
- Decision: stop phase if browser/platform support and costs do not justify operational complexity.

---

## 8. Exit criteria

- Only mark offline CRUD supported for explicitly tested operations.
- Push notification is opt-in, server-backed, observably delivered where platform supports it and has deduplication.
- Security/performance documentation states browser and offline limitations honestly.
