# TabDo UAT scheduled purge — operations and security

The GitHub scheduled purge **only targets UAT**. It does not run against production.
No live destructive testing or secret creation is automated by this PR.

## Operator setup (required before enabling the job)

1. In GitHub repository Environment **uat**, set `SUPABASE_UAT_URL` to
   `https://<UAT_PROJECT_REF>.supabase.co`; set `SUPABASE_UAT_PROJECT_REF`
   (the 20-character project reference). Values must match exactly.
2. Generate a unique random credential of at least 32 characters outside GitHub Actions.
   Set **the same** `PURGE_WORKER_SECRET` in GitHub Environment `uat`
   and in Supabase **UAT Edge Function secrets**.
   It must not equal any Supabase service-role or secret API key.
3. Redeploy `purge-deleted-tasks` to UAT with `--no-verify-jwt`. This is
   intentional for a server-to-server job: authorization is performed by
   `x-purge-secret` in the handler. Other Edge Functions keep their normal auth.
4. Apply migration `0012_purge_claim_guard.sql` before deploying the new worker.
5. Run `Scheduled Purge Worker (UAT)` manually once in GitHub Actions and inspect
   the safe `processed/purged/skipped` summary. Never test against production.

**Expected behavior:** missing/mismatched configuration fails the job; wrong
credential returns 401; partial Storage/DB failures return 503 and fail the job.
A zero-item run returns HTTP 200 with zero counts. The worker processes up
to 50 candidates per run, including tasks left in `purging` after a failed
attempt; unresolved work is retried at the next schedule. It does not report
task IDs, raw exceptions, or keys.

## Failure/recovery

- A task must be claimed with `purge_status='purging'` before deleting files.
- Claimed tasks cannot be restored; failed purges remain retryable.
- If errors persist, investigate Supabase Edge Function logs using safe categories,
  fix the underlying Storage/DB issue, and rerun. Do not manually delete rows
  or Storage objects without independent owner approval.
- Verify the latest run *actually executed*, not just that the workflow was green.
- The old direct SQL batch function is no longer granted to `service_role`:
  it did not clean up attached Storage objects.

## Verification still requiring environment access

Confirm hosted UAT secret values exist without printing them, compare UAT
deployment SHA to the PR merge, run an isolated attachment purge fixture,
and verify no other user's tasks or files were affected.
