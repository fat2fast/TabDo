# Phase 14 — Installable PWA & Safe Offline Shell

**Status:** Planned  
**Track:** Mobile Delivery  
**Depends on:** Phase 12 (mobile UX); Phase 10 release baseline  
**Delivery:** Post-MVP enhancement — not required for Phase 10 MVP release  
**Scope rule:** Keep one shared Web auth session; preserve per-user RLS; admin may view only numerical task counts, not user task details or perform cross-user task edits.

---

## 1. Goal

Make the TabDo **web** app installable on compatible desktop/mobile browsers, with an app-like standalone shell and safe static-asset caching. This phase does **not** promise offline task editing or background notifications.

Current baseline: `apps/web/index.html` includes only basic metadata and `apps/web/vite.config.ts` uses the React plugin, without a PWA manifest/service worker setup.

## 2. Manifest and app shell

- Add standards-based `manifest.webmanifest` with name, short name, start URL, scope, display mode (`standalone`), theme/background colors and appropriate icon sizes (at minimum 192×192 and 512×512; include maskable when assets exist).
- Add `theme-color`, favicon and platform-friendly app icons; design visual assets separately from the spec.
- Ensure Vercel SPA rewrites still work for installed launch URL and deep links.
- Provide a contextual 'Install TabDo' action when supported; fall back to browser-specific instructions if not.
- Test launch, app switching, orientation, splash icon rendering, multi-tab/session behavior.

## 3. Service worker strategy

- Prefer a maintained Vite PWA integration or minimal well-tested service worker; document the choice and avoid unnecessary custom runtime.
- Precache versioned static app assets with bounded retention.
- **Do not cache authenticated Supabase REST, Auth, Edge Functions, session tokens, or private task/attachment responses as public/shared runtime cache entries.**
- For application navigation, return cached SPA shell only when safe and explicitly display a connection/status message if remote data cannot load.
- On logout/account switch, clear any user-specific locally cached application state through an explicit, tested policy.
- Prevent stale-version loops and document service worker update semantics (`waiting`, refresh prompt, release rollback).

## 4. Installability and UX

- Mobile-first install banner only after the app is usable and browser eligibility is known; do not show a fake install button.
- Support standalone viewport including safe-area bottom navigation from Phase 12.
- Handle 'already installed', dismissed prompts and update available states.
- Keep user-specific task data fetching under existing TanStack Query/RLS mechanisms.

## 5. Notification reality check

- Chrome Extension alarms are desktop-browser extension behavior, not PWA notifications.
- Do not promise reminders while the PWA/browser is closed. Background notifications require a push infrastructure, browser permission and platform support (Phase 19).
- iOS/iPadOS and Android differ in install and push support; test real supported versions rather than assuming parity.

## 6. Security/performance tests

- Service worker cannot serve User A's private data to User B after logout/login.
- No session tokens or private storage objects in static cache.
- Installed app starts on a fresh launch; direct `/tasks/...` routes refresh correctly.
- Cache refresh retrieves new client version after deployment; no indefinite stale UI.
- Offline network failure shows an honest, non-destructive fallback (not 'saved successfully').
- Check Lighthouse PWA heuristics where applicable, but real-browser installation is the acceptance source.

## 7. Out of scope

- Offline CRUD queue, conflict resolution, IndexedDB data replica.
- Web Push backend and background recurring reminders.
- Share Target/file-handling integration.
- App store packaging, native app, custom backend API.

## 8. Implementation slices

1. Manifest/icons/metadata and dev/prod setup.
2. Safe static asset precache and navigation fallback.
3. Install prompt and update UX.
4. Session/cache isolation, offline error handling and cross-browser smoke tests.


---

## Implementation checklist (issue-ready)

- [ ] Create/install proper app icons and maintain icon source assets privately in repo (no font file exports).
- [ ] Add manifest/start URL/scope and test Vercel SPA navigation in standalone mode.
- [ ] Choose and pin a service-worker integration; document exact precache/runtime cache policies.
- [ ] Explicitly exclude Supabase Auth/PostgREST/Functions from public caching rules.
- [ ] Add install UI only when eligible; provide platform-specific fallback instructions.
- [ ] Implement visible `Update available` UI with safe refresh after user action.
- [ ] Handle offline session restoration failures without claiming tasks are accessible.
- [ ] Test logout/account switching with caches and installed app window still open.
- [ ] Run deployment smoke test with changed asset hashes and service-worker update flow.
- [ ] Document difference between extension alarms, PWA installability and Web Push.

## End-to-end acceptance walkthroughs

1. **Scenario 1:** New Android browser installs TabDo and launches an auth-aware standalone window at correct route.
2. **Scenario 2:** User disconnects network after first visit: static shell loads or safe offline screen appears, task save is not falsely acknowledged.
3. **Scenario 3:** User A signs out and User B signs in on shared device: service worker never displays User A task data.
4. **Scenario 4:** New deployment arrives while installed PWA is open: update prompt appears and post-update app works.

## Risks, tradeoffs and open decisions

- Risk: stale service worker locks users onto old frontend; **mitigation:** versioned cache and controlled update prompt.
- Risk: cached private data leaks between logins; **mitigation:** no authenticated API caching in this phase.
- Decision: all offline mutations are explicitly postponed to Phase 19.

---

## 9. Definition of Done

- Supported browsers can install and launch TabDo standalone.
- App shell can load from static cache without claiming task data is available offline.
- Updates are discoverable and safe, sensitive data is not inadvertently cached.
- Existing auth, deep links, routes and Vercel deployment continue working.
