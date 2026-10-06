# Init checklist

## 1. Requirements
- Node.js LTS
- pnpm
- Supabase project
- Vercel account

## 2. Install
```bash
pnpm install
```

## 3. Supabase
1. Create a Supabase project (or run local `supabase start`).
2. Copy Project URL and anon/public key.
3. Apply sequential migrations (`0001_init.sql` through `0005_phase_5_reminders.sql`) or run `supabase db reset`.
4. Enable Email/Password auth.

## 4. Environment
Create `apps/web/.env`:
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

For extension, create `apps/extension/.env` and wire the values into the extension client when implementing auth/sync.

## 5. Run
```bash
pnpm dev:web
pnpm dev:extension
```

## 6. Implementation progress
1. [x] Auth & Monorepo Foundation (Phase 0 & 1)
2. [x] Task CRUD (Phase 2)
3. [x] Category + priority + subtask (Phase 2)
4. [x] Today / Upcoming / Inbox / Smart Views (Phase 3)
5. [x] Schedule / calendar (Phase 4)
6. [x] Reminder data model & web UI (Phase 5)
7. [ ] Extension sync + chrome.alarms & notifications (Phase 6 — Next up)
8. [ ] Recurring tasks (Phase 7)
9. [ ] Dashboard (Phase 8)
10. [ ] Daily/weekly summary (Phase 9)
11. [ ] MVP Hardening & Release (Phase 10)
