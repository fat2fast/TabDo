# TabDo Project Rules

Apply these rules to code, tests, configuration, migrations, and deployment
changes in this repository. They supplement the repository's development
workflow; they do not replace a user's accepted scope.

## Architecture boundaries

- Treat both `apps/web` and `apps/extension` as untrusted clients. They may use
  only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (or legacy `SUPABASE_ANON_KEY`); never expose, import, log, or
  bundle `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`).
- Keep normal user-owned CRUD on the Supabase client API and enforce it with
  RLS. Use an Edge Function or trusted bootstrap script only for an operation
  that genuinely requires server-side privilege, such as admin user creation.
- A route guard is a navigation convenience, not authorization. New or changed
  database access must preserve an RLS policy that proves ownership.
- Personal-data tables use `user_id` and must be restricted to the authenticated
  owner. An `admin` profile role does not implicitly grant access to another
  user's personal records.
- There is one Supabase Auth session. `/login` and `/admin/login` are entry
  points to that same session; roles decide area access, not separate auth
  systems.

## Ownership and package boundaries

- Keep shared domain contracts in `packages/types`, pure cross-client logic in
  `packages/utils`, and client-safe Supabase construction/helpers in
  `packages/supabase`. Do not duplicate these contracts independently in Web
  and Extension.
- Database timestamps are `timestamptz`. Convert for display at the client edge
  using the user's `profiles.timezone` (default `Asia/Ho_Chi_Minh`), and
  centralize reusable timezone logic in `packages/utils`.
- In Web, use TanStack Query for Supabase-backed data. Zustand is only for local
  UI state; do not mirror server entities into a Zustand store.

## Extension and reminder invariants

- Supabase is the remote source of truth. `chrome.storage.local` contains only
  the extension session, cached reminders, sync metadata, or preferences.
- Keep the reminder flow intact: Supabase reminder data → extension sync →
  `chrome.storage.local` → `chrome.alarms` → `chrome.notifications`. Changes
  that alter reminder time, status, or identity must reconcile the local alarm
  and cache so stale notifications cannot fire.
- Do not put privileged administrative operations in the extension.

## UI / UX design & interaction rules

- **Strict Custom Dropdown Rule**: Never use unstyled native HTML `<select>` elements in user-facing UI. Always use the project's custom dropdown component (`CustomDropdown` in `apps/web/src/components/ui/custom-dropdown.tsx`) or bespoke styled listboxes with custom trigger buttons, chevron icons, active indicator states, and proper keyboard navigation / accessibility.
- **Button vs Hyperlink Rule**: Never render action controls or widget navigation triggers as raw hyperlinks with default browser text/underline styling (`<a>` or `<Link>` with raw blue text). Style them as cohesive pill/button controls (`.dashboard-action-btn`, `btn-secondary`, `btn-ghost-sm`) with icons and interactive hover/active states.
- **Visual Metadata Consistency**: Recurring tasks must always display clear visual cycle indicators (repeat icon/badge with localized summary) in task list items and detail views so users can immediately identify recurring schedules.
- **Action Blocking Feedback Rule**: Any blocked operation (such as attempting to reopen a recurring task that has already spawned a successor occurrence) must present clear, explicit feedback to the user via a confirmation/alert dialog (`useConfirm` with `variant: 'warning'`), never failing silently or leaving the user confused.

## Change checks

- When changing schema or RLS, inspect every affected query and validate that
  `auth.uid()` ownership remains true for `select`, `insert`, `update`, and
  `delete` as applicable.
- When adding a web route, preserve Vercel SPA fallback behavior for direct
  navigation.
- Before handoff, validate the changed behavior at the narrowest useful level.
  Re-run the focused automated test when it exists. Add or update a
  deterministic automated test for new business logic or a bug fix when the
  repository's test tooling can exercise it; test observable behavior rather
  than implementation details.
- Always typecheck the affected workspace package after TypeScript changes.
  Also build the affected app when a change touches its entry point, bundler
  configuration, environment-variable usage, routing, or extension manifest.
  Run root `pnpm typecheck` and `pnpm build` when a shared package, shared
  contract, workspace configuration, or cross-client behavior changes.
- Use the project's existing test runner and scripts; do not invent a one-off
  command or claim automated coverage that is not configured. This repository
  currently has no `test` script, so report the validation gap if no relevant
  automated suite exists instead of calling typechecking a behavioral test.
- For migrations and RLS, exercise them only against a local or non-production
  Supabase environment. Where that environment is unavailable, statically
  review the migration and all affected queries, then explicitly report that
  integration validation remains outstanding.
- Run workspace commands from an interactive WSL shell, for example:
  `wsl.exe -d Ubuntu-24.04 -- bash -ic "cd /home/phatp/work/tabdo && pnpm typecheck"`.
  Start with the affected package (`pnpm --filter <package> typecheck` or
  `build`), then run root checks when shared contracts change.

## Architecture reference

Read [docs/architecture.md](docs/architecture.md) before making a change that
crosses client, Supabase, authentication, authorization, reminder, timezone, or
deployment boundaries. The phase documents in `docs/phases/` define intended
feature behavior and take precedence for their phase-specific scope.
