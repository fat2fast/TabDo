---
name: tabdo-architecture
description: Implement or review TabDo changes that touch the Web app, browser extension, Supabase, authentication, authorization, reminders, or timezone handling. Use to preserve this monorepo's client and data-boundary invariants.
---

# TabDo Architecture Guardrails

Read `docs/architecture.md` and the relevant file(s) in `docs/phases/` before
changing a cross-boundary behavior. Keep the solution within the phase and the
user's requested scope.

## Choose the correct boundary

- Both Web and Extension are untrusted. Client code can use only the public
  Supabase URL and anon key. A service-role credential belongs only in a trusted
  bootstrap process, Edge Function, or secure deployment environment.
- Use direct Supabase access for ordinary user-owned CRUD and make RLS the data
  boundary. UI route guards and profile-role checks do not replace RLS.
- Use an Edge Function only when server-side privilege is needed. For MVP admin
  provisioning, the trusted path is `admin-create-user`; do not move it into a
  browser client.
- Preserve the single Supabase Auth session. The admin login route is not a
  separate identity system.

## Preserve data and state ownership

- For personal records, verify that the affected table/query is scoped to its
  owner (`auth.uid() = user_id`, or `id` for `profiles`). Do not assume an admin
  role can read or modify another user's personal data.
- Put shared domain types in `@tabdo/types`, pure cross-client helpers in
  `@tabdo/utils`, and client-safe client creation in `@tabdo/supabase`.
- Use TanStack Query for Web server state. Use Zustand only for local UI state;
  invalidate or update query data after a successful remote mutation rather than
  creating a second entity cache.

## Handle time and reminders as a distributed flow

- Store and transmit instants as `timestamptz`; render and accept local values
  using `profiles.timezone` (default `Asia/Ho_Chi_Minh`). Put reusable conversion
  rules in `@tabdo/utils` rather than reimplementing them per client.
- The extension's Supabase data is authoritative. `chrome.storage.local` is a
  cache for session, reminders, sync metadata, and preferences.
- When a reminder is created, changed, completed, dismissed, or deleted,
  reconcile its `chrome.alarms` entry and cached representation. Notification
  scheduling follows: Supabase → extension sync → storage → alarm → notification.

## Review before handoff

For each changed boundary, state which invariant was checked:

| Change type | Required check |
| --- | --- |
| Client/Supabase data access | RLS still limits access to the authenticated owner. |
| Auth or admin behavior | No client obtains privileged credentials; role checks are not the data boundary. |
| Shared contract | Web and Extension consume the shared package, with focused typecheck/build. |
| Reminder mutation or sync | Cache and alarm cleanup/recreation cannot leave a stale notification. |
| Date/time behavior | An instant is not reinterpreted in the wrong timezone. |
| Web route or deploy config | Vercel's SPA fallback still serves direct route navigation. |

## Validate after implementation

Run checks through interactive WSL. Choose the smallest verification ladder
that covers the change, then broaden only when the change crosses a boundary:

1. Re-run the focused automated test if one exists. For deterministic business
   logic or a regression fix, add or update a behavior-focused automated test
   when the configured test tooling can run it.
2. Run `pnpm --filter <affected-package> typecheck` for TypeScript changes.
   Build an affected app when its entry point, route, bundler/configuration,
   environment-variable handling, or extension manifest changes.
3. Run root `pnpm typecheck` and `pnpm build` after changes to a shared package,
   shared contract, workspace configuration, or Web/Extension integration.
4. Validate migration and RLS behavior only against local or non-production
   Supabase. If that is unavailable, review the changed policies and every
   affected query, and name the outstanding integration-validation gap.

The current workspace has no `test` script. Do not describe typechecking as a
behavioral test or claim automated coverage that does not exist. Use a future
configured test runner rather than introducing a one-off validation command.
Do not weaken a type, RLS policy, or validation merely to make a check pass.
