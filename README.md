# Task MVP

Personal task, schedule, reminder and summary MVP.

## Stack
- Web: React + Vite + TypeScript
- Extension: WXT + React + TypeScript
- Backend: Supabase (Auth + Postgres + RLS)
- Hosting: Vercel
- Monorepo: pnpm workspaces

## Bootstrap

```bash
pnpm install
cp .env.example apps/web/.env
cp .env.example apps/extension/.env
pnpm dev:web
```

Extension:

```bash
pnpm dev:extension
```

## Supabase
Apply SQL in `supabase/migrations/0001_init.sql` through Supabase SQL editor or CLI.

## Vercel
Create a Vercel project from the repository and set **Root Directory** to `apps/web`.
Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Environment Variables.
`apps/web/vercel.json` already contains the SPA rewrite for React Router.
