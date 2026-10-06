# TabDo

TabDo is a personal productivity platform combining task management, calendar scheduling, persistent reminders, and AI summaries across web and browser extension interfaces.

## Technology Stack

- **Web Portal:** React 19, React Router 7, TanStack Query, Vite, TypeScript
- **Browser Extension:** WXT, React 19, TypeScript (Manifest V3)
- **Backend & Data Boundary:** Supabase (Auth, Postgres, Row-Level Security, Edge Functions)
- **Package Manager & Monorepo:** pnpm workspaces (`@tabdo/*`)
- **Web Deployment:** Vercel SPA

## Repository Structure

```
├── apps/
│   ├── web/               # Web client SPA (@tabdo/web)
│   └── extension/         # Manifest V3 browser extension (@tabdo/extension)
├── packages/
│   ├── types/             # Shared domain types & contracts (@tabdo/types)
│   ├── utils/             # Pure cross-client utilities (@tabdo/utils)
│   └── supabase/          # Client-safe Supabase factory (@tabdo/supabase)
├── scripts/
│   ├── bootstrap-admin.ts # Trusted admin account initialization
│   └── test-integration.ts# Live RLS and Edge Function integration tests
└── supabase/
    ├── functions/         # Privileged Edge Functions (admin-create-user)
    ├── migrations/        # Sequential SQL migrations (0001-0005)
    └── tests/             # pgTAP database security & RLS test suite
```

## Getting Started

### 1. Prerequisites

- **Node.js:** `>= 22.12.0` (check with `node -v`)
- **pnpm:** `12.9.1`
- **Docker:** Running (for local Supabase CLI)
- **Supabase CLI:** Installed locally

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Configuration

TabDo strictly enforces untrusted client boundaries: client apps only receive public Supabase URL and anon keys.

- **Web client:**
  ```bash
  cp apps/web/.env.example apps/web/.env
  ```
  Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

- **Extension client:**
  ```bash
  cp apps/extension/.env.example apps/extension/.env
  ```
  Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

- **Trusted operational bootstrap (server/admin only):**
  ```bash
  cp .env.bootstrap.example .env.bootstrap
  ```
  Configure `SUPABASE_SERVICE_ROLE_KEY`, `TABDO_ADMIN_EMAIL`, and `TABDO_ADMIN_PASSWORD`.  
  *Never commit `.env.bootstrap` or bundle service-role credentials into client packages.*

### 4. Local Database & Migrations

Start the local Supabase containers and apply all migrations:

```bash
supabase start
supabase db reset
```

This applies:
- `0001_init.sql`: Core schema, constraints, and baseline RLS policies.
- `0002_phase_0_foundation.sql`: Profile roles (`admin`/`user`), user creation triggers, status normalization, personal data index additions, and client table grants.
- `0003_phase_2_task_invariants.sql`: Task validation, checklist subtasks, categories, and owner isolation invariants.
- `0004_phase_4_schedule_blocks.sql`: Schedule blocks table, same-owner validation triggers, and time range indexing.
- `0005_phase_5_reminders.sql`: Reminder engine, absolute/relative calculations, snooze/dismiss states, and task completion triggers.

### 5. Provision Initial Admin

Initialize the primary administrative account using the trusted script:

```bash
pnpm bootstrap:admin
```

This ensures the user exists in Supabase Auth and their profile role is set to `admin`.

### 6. Development Servers

- **Web app:**
  ```bash
  pnpm dev:web
  ```
  Opens at `http://localhost:5173`.
  - `/login`: User portal sign-in.
  - `/admin/login`: Administrative portal sign-in.
  - `/tasks`: Core task workspace with smart views (`Inbox`, `Today`, `Upcoming`, `Completed`, `Trash`).
  - `/calendar`: Day and week calendar with task scheduling and block drag/resize.
  - `/admin/users`: Admin user creation and management.
  - `/settings`: User account preferences and password management.

- **Browser extension:**
  ```bash
  pnpm dev:extension
  ```

## Implementation Status

TabDo is following an incremental roadmap defined in [`docs/phases/README.md`](docs/phases/README.md):

- ✅ **Phase 0:** Monorepo Foundation & Init (`@tabdo/*`, Supabase schema & migrations `0001`-`0002`)
- ✅ **Phase 1:** Authentication, Portal Routing & Admin User Provisioning (`admin-create-user` Edge Function)
- ✅ **Phase 2:** Core Task Management (Task CRUD, priorities, categories, checklist subtasks, markdown editor)
- ✅ **Phase 3:** Smart Task Views & Organization (`Inbox`, `Today`, `Upcoming`, `Completed`, `Trash`, search/filter)
- ✅ **Phase 4:** Scheduling & Calendar (Migration `0004`, FullCalendar Standard day/week views, schedule blocks)
- ✅ **Phase 5:** Reminder Engine (Migration `0005`, absolute & relative-to-due triggers, presets, snooze/dismiss)
- ⏳ **Phase 6 (Next Up):** Browser Extension (`chrome.storage.local` sync, `chrome.alarms` & `chrome.notifications`)
- 📋 **Phases 7–10:** Recurring tasks, Dashboard, Summaries, and MVP Hardening

## Quality Gates & Verification

Run verification checks before submitting changes:

```bash
# 1. Typecheck all workspaces
pnpm typecheck

# 2. Run web feature test suite
pnpm test

# 3. Build web and extension bundles
pnpm build

# 4. Run pgTAP database security test suite
supabase test db

# 5. Run live RLS boundary and Edge Function integration tests
pnpm test:integration
```

## Security & Architecture Invariants

1. **Untrusted Clients:** Neither `apps/web` nor `apps/extension` may import, expose, or log `SUPABASE_SERVICE_ROLE_KEY`.
2. **Single Auth Session:** All portals (`/login`, `/admin/login`) authenticate against the same Supabase Auth instance.
3. **Data Boundary:** UI route guards do not substitute for authorization. Personal tables (`tasks`, `reminders`, `categories`, `schedule_blocks`, `task_activities`) enforce `auth.uid() = user_id` via RLS.
4. **Admin Role Isolation:** An `admin` profile role does not grant access to another user's personal data.
5. **Privileged Operations:** User provisioning with role assignments is performed only via the server-side `admin-create-user` Edge Function or trusted bootstrap scripts.
