# Phase 6 — Browser Extension

**Status:** Planned (Next up)  
**Depends on:** Phases 1, 2, 5  
**Blocks:** Full reminder experience

## 1. Goal

Make TabDo useful without keeping the web app open.

The extension should focus on:

- Today
- Quick Add
- reminders
- snooze
- complete
- open task

It should not become a second full application.

---

## 2. Extension scope

MVP views:

1. Sign In
2. Today
3. Quick Add
4. Settings / connection info

No admin portal exists inside the extension.

An admin account may sign in and use the extension exactly like a personal user.

---

## 3. Authentication

The extension uses Supabase Auth with existing TabDo accounts.

No Sign Up.

Because extension storage differs from normal web localStorage, configure Supabase auth persistence with a storage adapter backed by:

    chrome.storage.local

Store:

- Supabase session
- optional profile cache
- last sync timestamp

Never store:

- Service Role key
- plaintext user password after login

---

## 4. Extension entrypoints

Recommended WXT structure:

    apps/extension/
    ├── entrypoints/
    │   ├── background.ts
    │   └── popup/
    │       ├── index.html
    │       ├── main.tsx
    │       └── App.tsx
    ├── components/
    ├── lib/
    └── wxt.config.ts

Use background/service-worker logic for:

- synchronization
- alarms
- notifications
- notification actions

Popup handles user interaction.

---

## 5. Required permissions

Minimum expected:

- `storage`
- `alarms`
- `notifications`

If Quick Capture reads current tab URL, add:

- `activeTab`

Avoid broad host permissions if not needed.

---

## 6. Today popup

Suggested display:

    Today
    3 / 7 completed

    ✓ Check email

    □ Prepare contract
      16:00

    □ Send report
      17:00

Actions:

- complete
- reopen if useful
- open task
- Quick Add

Keep popup fast; avoid loading complex analytics.

---

## 7. Quick Add

Minimum:

- title

Optional fields:

- due date/time
- reminder preset

If `activeTab` enabled:

- checkbox: Attach current page

Then store:

    source_url = current tab URL

Do not automatically capture page contents.

---

## 8. Reminder sync lifecycle

On extension startup:

1. restore auth session
2. verify/refresh session
3. fetch upcoming reminders
4. store normalized reminder cache
5. reconcile Chrome alarms

Also sync:

- when popup opens
- after Quick Add
- after complete/snooze
- every 15–30 minutes

Do not fetch Supabase every minute.

---

## 9. Alarm reconciliation

The extension must reconcile rather than blindly append alarms.

For each upcoming reminder:

- derive stable alarm name, e.g. `reminder:<id>`
- create/update alarm at effective fire time

For local alarms with no matching remote reminder:

- remove them

For changed reminder timestamp:

- clear old alarm
- create new one

This is important after browser restart or deadline edits.

---

## 10. Notification behavior

When alarm fires:

1. load cached reminder/task data
2. optionally confirm task still active
3. show notification

Notification content:

- task title
- deadline context if available

Actions:

- Done
- Snooze
- Open

Keep text concise.

---

## 11. Done action

When user presses Done:

1. update task status to `done`
2. set completed_at
3. dismiss future reminders for task
4. remove matching local alarms
5. refresh local Today cache

If network update fails:

- do not pretend completion succeeded permanently
- show retry/failure signal where possible

---

## 12. Snooze action

Because browser notification button counts are limited, one button may open popup or use a default snooze.

Recommended MVP:

- notification button: `Snooze 15m`
- popup/detail can offer 30m / 1h / custom

On snooze:

- update reminder status
- set snoozed_until
- create new local alarm

Remote state is source of truth.

---

## 13. Open action

Open the task in the web app.

Suggested deep link:

    https://<tabdo-domain>/tasks/<taskId>

If task drawer is route-driven, this should open directly to task detail.

Avoid opening generic dashboard when a task-specific URL is available.

---

## 14. Offline behavior

MVP can support limited offline resilience:

- existing cached reminders can still fire
- cached Today list may display with stale indicator
- mutations require network and should retry later only if explicitly implemented

Do not build a full offline-first sync engine.

---

## 15. Session expiry

If session refresh fails:

- clear invalid session safely
- show Sign In state in popup
- background sync stops privileged queries
- existing alarms may optionally remain, but clicking them should prompt login if needed

Document the behavior.

---

## 16. Security

- use anon key only
- rely on RLS
- no Service Role
- no admin create-user functionality
- no credential logging
- minimize extension permissions
- validate task ownership through RLS

---

## 17. Performance

Popup should render quickly.

Use local cache for immediate display, then refresh from Supabase.

Avoid importing the entire web UI bundle.

Share only:

- types
- utilities
- Supabase factory
- selected UI primitives if lightweight

---

## 18. Tests

Manual/automated scenarios:

- fresh install
- sign in
- browser restart
- extension restart
- session restore
- upcoming reminder sync
- alarm created
- changed reminder re-schedules alarm
- deleted reminder removes alarm
- Done action
- Snooze action
- Open task action
- offline alarm firing
- expired session
- admin account behaves as normal extension user

---

## 19. Out of scope

- admin user management
- full calendar in popup
- full summary dashboard
- cross-browser store publishing
- email reading
- page-content scraping
- AI assistant
- full offline sync

---

## 20. Definition of Done

Phase 6 is done when:

1. Existing user/admin can sign in.
2. No signup exists.
3. Today list displays.
4. Quick Add works.
5. Upcoming reminders sync.
6. Alarms survive/rebuild after restart.
7. Notifications fire at expected time.
8. Done updates remote task.
9. Snooze re-schedules correctly.
10. Open launches related web task.
11. No privileged secret is included in extension.
