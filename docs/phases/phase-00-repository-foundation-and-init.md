# Phase 0 — Repository Foundation & Project Init

**Status:** Planned  
**Depends on:** None  
**Blocks:** All later phases

## 1. Goal

Prepare TabDo as a stable monorepo that can be installed, built, tested, deployed, and extended without restructuring the project during feature development.

This phase is complete only when both the web application and browser extension build successfully, Supabase migrations apply cleanly, role/auth foundations exist, and CI catches basic regressions.

Phase 0 should not implement product workflows such as task CRUD or reminder behavior.

---

## 2. Scope

### Included

- Rename temporary `task-mvp` package names to `tabdo`.
- Standardize Node and pnpm versions.
- Pin dependency versions.
- Fix WXT React setup.
- Finalize monorepo package boundaries.
- Standardize Supabase client creation.
- Add initial database schema.
- Add `admin` / `user` role model.
- Enable RLS.
- Add basic indexes.
- Add admin bootstrap script.
- Scaffold `admin-create-user` Edge Function.
- Configure Vercel SPA routing.
- Add validation scripts and GitHub Actions.
- Document environment variables.

### Not included

- Full sign-in UI.
- Admin user-management UI.
- Task CRUD.
- Calendar.
- Reminder runtime.
- Browser-extension synchronization.
- Dashboard/summary implementation.

---

## 3. Target repository structure

    TabDo/
    ├── apps/
    │   ├── web/
    │   └── extension/
    ├── packages/
    │   ├── supabase/
    │   ├── types/
    │   ├── ui/
    │   └── utils/
    ├── scripts/
    │   └── bootstrap-admin.ts
    ├── supabase/
    │   ├── functions/
    │   │   └── admin-create-user/
    │   ├── migrations/
    │   └── seed.sql
    ├── docs/
    │   ├── mvp-roadmap.md
    │   └── phases/
    ├── .nvmrc
    ├── package.json
    ├── pnpm-lock.yaml
    ├── pnpm-workspace.yaml
    └── README.md

---

## 4. Package naming

Rename:

- `task-mvp` → `tabdo`
- `@task-mvp/web` → `@tabdo/web`
- `@task-mvp/extension` → `@tabdo/extension`
- `@task-mvp/types` → `@tabdo/types`
- `@task-mvp/utils` → `@tabdo/utils`
- `@task-mvp/supabase` → `@tabdo/supabase`
- `@task-mvp/ui` → `@tabdo/ui`

Search the repository for `task-mvp` after the rename. The old namespace should not remain in package manifests, imports, documentation, or lockfile metadata.

---

## 5. Runtime versions

Target:

    Node >= 22.12
    pnpm >= 10

Root `package.json` should include:

    "engines": {
      "node": ">=22.12.0"
    }

Add `.nvmrc`:

    22

The repository should also declare the package manager where practical:

    "packageManager": "pnpm@<pinned-version>"

Do not depend on whichever global pnpm version happens to exist on a developer machine.

---

## 6. Dependency policy

Do not keep `"latest"` in production or development dependencies.

Pin compatible semver ranges for at least:

- React
- React DOM
- Vite
- TypeScript
- React Router
- TanStack Query
- Zustand
- Supabase JS
- WXT
- WXT React module

Commit `pnpm-lock.yaml`.

CI must use:

    pnpm install --frozen-lockfile

The goal is reproducible builds.

---

## 7. WXT configuration

Use the supported React module configuration.

Example direction:

    import { defineConfig } from 'wxt'

    export default defineConfig({
      modules: ['@wxt-dev/module-react'],
      manifest: {
        name: 'TabDo',
        description: 'Personal task and reminder companion',
        permissions: [
          'storage',
          'alarms',
          'notifications',
        ],
      },
    })

Add host permissions only when actually required.

Avoid broad permissions during MVP development.

---

## 8. Shared package boundaries

### `@tabdo/types`

Own shared TypeScript domain types that are safe to use in both web and extension.

Examples:

- Task
- TaskStatus
- TaskPriority
- Category
- Reminder
- ScheduleBlock
- UserProfile
- UserRole

Do not put Supabase secrets or environment-specific logic here.

### `@tabdo/utils`

Own pure utilities.

Examples:

- date helpers
- overdue calculation
- timezone-safe conversion helpers
- status formatting
- validation helpers that do not depend on UI

### `@tabdo/supabase`

Own shared Supabase client factory and reusable safe helpers.

The package may expose something similar to:

    createTabDoClient({
      url,
      anonKey,
      options
    })

The web and extension may provide different storage adapters later, but client creation logic should not be duplicated.

### `@tabdo/ui`

Keep reusable UI primitives only.

Do not move feature-specific screens into this package.

---

## 9. Initial role model

MVP roles:

    admin
    user

`profiles` should include:

- `id`
- `display_name`
- `timezone`
- `role`
- `created_at`
- `updated_at`

Recommended database rule:

    role text not null default 'user'
    check (role in ('admin', 'user'))

Important:

- A normal client must not be able to promote itself to `admin`.
- `admin` does not mean "can read all personal data".
- Admin's elevated capability is limited to trusted user provisioning.

---

## 10. Initial database schema

At minimum:

### `profiles`

Stores application profile data linked 1:1 to `auth.users`.

### `categories`

Personal user-owned categories.

Fields should include:

- id
- user_id
- name
- optional icon
- optional color
- timestamps

### `tasks`

Fields should include:

- id
- user_id
- parent_id
- category_id
- title
- description
- status
- priority
- start_at
- due_at
- completed_at
- source_url
- recurrence_rule
- created_at
- updated_at

### `reminders`

Fields should include:

- id
- user_id
- task_id
- remind_at
- status
- snoozed_until
- timestamps

### `schedule_blocks`

Fields should include:

- id
- user_id
- task_id
- title
- start_at
- end_at
- timestamps

### `task_activities`

Fields should include:

- id
- user_id
- task_id
- action
- metadata JSONB
- created_at

---

## 11. Database constraints

At minimum, add checks for:

### Task status

    todo
    in_progress
    done

### Priority

    low
    medium
    high

### Reminder status

Prepare for:

    pending
    triggered
    snoozed
    dismissed

Ensure `end_at > start_at` for schedule blocks.

Do not store `overdue` as a task status.

`overdue` is derived from:

    due_at < now()
    AND status != 'done'

---

## 12. RLS foundation

Enable RLS for every user-owned table.

Personal-data policies must follow the principle:

    auth.uid() = user_id

For `profiles`, users should be able to read their own profile.

Do not write a policy such as:

    role = 'admin' OR auth.uid() = user_id

for tasks/reminders/schedules. That would give admin unintended access to personal data.

Admin user creation must be handled through a trusted Edge Function, not through broad table policies.

---

## 13. Indexes

Add indexes for expected MVP query patterns.

Recommended minimum:

    tasks(user_id, due_at)
    tasks(user_id, status)
    tasks(user_id, category_id)
    tasks(user_id, completed_at)

    reminders(user_id, remind_at)
    reminders(task_id)

    schedule_blocks(user_id, start_at)
    schedule_blocks(task_id)

    task_activities(user_id, created_at)
    task_activities(task_id, created_at)

Indexes should be reviewed again in Phase 10 using real query patterns.

---

## 14. Environment variables

### Client-safe web environment

`apps/web/.env.example`:

    VITE_SUPABASE_URL=
    VITE_SUPABASE_ANON_KEY=

These values are client-visible and must be protected by RLS, not secrecy.

### Trusted bootstrap environment

`.env.bootstrap.example`:

    SUPABASE_URL=
    SUPABASE_SERVICE_ROLE_KEY=
    TABDO_ADMIN_EMAIL=
    TABDO_ADMIN_PASSWORD=

Never prefix Service Role credentials with `VITE_`.

Never commit real values.

---

## 15. Admin bootstrap script

Create:

    scripts/bootstrap-admin.ts

Responsibilities:

1. Read trusted environment variables.
2. Connect to Supabase with the Service Role.
3. Search for the configured admin account.
4. If absent, create the Auth user.
5. Ensure the matching profile exists.
6. Ensure profile role is `admin`.
7. Exit successfully if the admin is already configured.

The script must be idempotent.

Suggested command:

    pnpm bootstrap:admin

The script should never print the admin password or Service Role key.

---

## 16. `admin-create-user` Edge Function scaffold

Create:

    supabase/functions/admin-create-user/

Phase 0 only needs the function structure, local configuration, and basic request/response skeleton.

Full authorization and user creation behavior belongs to Phase 1.

The function must be designed to:

- receive the caller's JWT
- resolve the caller's identity
- verify caller role
- use Service Role only inside the trusted Supabase environment

---

## 17. Vercel configuration

Because the web app uses client-side routing, direct refreshes must work.

Examples:

- `/login`
- `/admin/login`
- `/dashboard`
- `/tasks`
- `/calendar`
- `/summary`
- `/admin/users`

Vercel must rewrite application routes to `index.html`.

Do not rely on Vercel-specific backend services for core MVP business logic.

---

## 18. Root scripts

Root `package.json` should expose at least:

    pnpm dev:web
    pnpm dev:extension
    pnpm build
    pnpm typecheck
    pnpm lint
    pnpm bootstrap:admin

If workspace-level scripts differ, root scripts should orchestrate them predictably.

---

## 19. CI

Create GitHub Actions that run on pull requests and relevant pushes.

Required:

1. Checkout.
2. Setup Node.
3. Setup pnpm.
4. `pnpm install --frozen-lockfile`
5. `pnpm typecheck`
6. `pnpm build`

Recommended:

7. `pnpm lint`
8. unit tests when tests are added

CI must not require production Service Role credentials merely to build the repository.

---

## 20. Testing checklist

Manual verification:

- Fresh clone installs.
- Web starts.
- Extension starts.
- Web builds.
- Extension builds.
- Migration applies to a clean Supabase project.
- RLS is enabled.
- No secret appears in generated web assets.
- `pnpm bootstrap:admin` can be run twice safely.
- Vercel route refresh behavior works.

---

## 21. Deliverables

- Updated monorepo packages.
- Pinned dependencies.
- `.nvmrc`.
- Environment examples.
- Initial migrations.
- Role model.
- RLS policies.
- Indexes.
- Admin bootstrap script.
- Edge Function scaffold.
- Vercel configuration.
- CI workflow.
- Updated README setup instructions.

---

## 22. Definition of Done

Phase 0 is done when:

- `pnpm install` succeeds on a clean checkout.
- No production dependency uses `latest`.
- Web dev server starts.
- Extension dev server/build starts.
- Production builds succeed.
- Migrations apply successfully.
- RLS exists for every user-owned table.
- Admin bootstrap is idempotent.
- No privileged secret is committed or bundled.
- CI passes.
- Old `task-mvp` naming is gone.
- Repository documentation identifies the product as TabDo.
