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
1. Create a Supabase project.
2. Copy Project URL and anon/public key.
3. Apply `supabase/migrations/0001_init.sql`.
4. Enable Email/Password auth first.

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

## 6. Recommended implementation order
1. Auth
2. Task CRUD
3. Today / Upcoming / Overdue
4. Category + priority + subtask
5. Schedule/calendar
6. Reminder data model
7. Extension sync + chrome.alarms
8. Dashboard
9. Daily/weekly summary
