# UAT Deployment Runbook

_([Bản tiếng Việt](uat-deployment.vi.md))_

This runbook covers the isolated TabDo User Acceptance Testing (UAT) environment. The repository currently has no Production environment. Only pushes to `uat` deploy to cloud; production deployment, pull request previews, and Supabase preview branches are out of scope.

## Topology

```text
Local development → main (latest source) → reviewed merge to uat → UAT Supabase → UAT Vercel
```

Supabase is the UAT source of truth. GitHub Actions applies migrations, deploys the Supabase Edge Functions (`admin-create-user`, `admin-users`, `complete-initial-password`), then builds and deploys the Web SPA. Vercel's automatic Git deployments must be disabled for the UAT project so they cannot bypass this order.

## Prerequisites

- A dedicated Supabase Cloud UAT project and a dedicated Vercel UAT project. Do not reuse Production resources or copy Production personal data into UAT.
- A stable UAT hostname, such as the Vercel project domain or a custom domain.
- A GitHub Environment named exactly `uat`. Store deployment credentials as environment secrets, not repository secrets:
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_UAT_PROJECT_REF`
  - `SUPABASE_UAT_DB_PASSWORD`
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`
- Scope the Supabase access token to the UAT project where possible, and the Vercel token to the UAT team/project. Do not add `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to GitHub or Vercel.
- Configure the Vercel UAT project Root Directory as `apps/web`, Build Command as `pnpm build` (the package runs `tsc -b && vite build`), and Output Directory as `dist`. Set only the UAT public client variables there: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or legacy `VITE_SUPABASE_ANON_KEY`). Disable automatic Git deployments; GitHub Actions is the only deployment path.
- In Supabase UAT Dashboard → Authentication → URL Configuration, set Site URL to the stable UAT hostname and add only the exact UAT redirect URLs used by the Web app. Keep local URLs in `supabase/config.toml` for local development.
- Create and protect the `uat` branch from a reviewed `main` commit. Merge updates from `main` through the repository's review and CI policy.

## Release procedure

1. Develop and test changes locally. Schema changes must be represented by a new sequential file under `supabase/migrations/`; do not edit migrations already applied to a remote database.
2. Merge the change into `main` after review and CI.
3. Open and merge a reviewed update from `main` into `uat`. A push to `uat` starts `.github/workflows/deploy-uat.yml`; a manual dispatch must also select the `uat` branch.
4. The workflow runs `pnpm install --frozen-lockfile`, lint, typecheck, tests, and builds before deployment credentials are made available.
5. The deploy job links the Supabase project using `SUPABASE_UAT_PROJECT_REF`, prints migration history, applies pending migrations with `supabase db push`, and deploys Edge Functions (`admin-create-user`, `admin-users`, `complete-initial-password`). It does not seed the database or repair migration history.
6. It then pulls the UAT Vercel project's production-environment settings, builds the project configured with Root Directory `apps/web`, and deploys the prebuilt artifact as a production deployment of the isolated UAT Vercel project. The values of public Supabase variables come from that Vercel project's settings.
7. Review the workflow summary for the commit, deployment URL, and step outcomes. Visit `/login` and a protected deep link such as `/tasks`; sign in only with a UAT test account and confirm browser requests use the UAT Supabase hostname.

The validation job uses inert `VITE_` placeholders so extension manifest generation and builds do not need UAT credentials. Those values are not deployment secrets and are not uploaded as an artifact.

## Recovery and rollback

- If validation fails, no UAT deployment runs. Fix the failure in `main`, merge the reviewed change to `uat`, and allow the workflow to run again.
- If a migration fails or migration history differs from the repository, stop the release. Inspect `supabase migration list --linked` against the UAT project and reconcile the history with a reviewed database change. Never run `supabase migration repair` automatically or to silence an unexplained mismatch.
- Database migrations are forward-only. Correct an applied schema change with a reviewed compensating migration; do not edit or remove an already-applied migration.
- To roll back the Web UI, redeploy the previous Ready deployment from the UAT Vercel project. This does not roll back database schema. Confirm that the old Web version remains compatible with the current schema before rollback.
- If the UAT project is linked incorrectly, stop the workflow and verify the GitHub Environment project ref and the Supabase Dashboard project before any retry. Never use `supabase db reset --linked` for recovery.

## Official references

- [Supabase: Managing environments](https://supabase.com/docs/guides/deployment/managing-environments)
- [Supabase: Database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase: Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Vercel: Deploying GitHub projects](https://vercel.com/docs/git/vercel-for-github)
- [TabDo architecture and security boundaries](architecture.md)
