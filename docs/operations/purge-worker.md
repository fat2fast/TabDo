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
3. Apply `0013_purge_claim_guard.sql` to the **UAT database first**. Then redeploy `purge-deleted-tasks` to UAT with `--no-verify-jwt`. This is
   intentional for a server-to-server job: authorization is performed by
   `x-purge-secret` in the handler. Other Edge Functions keep their normal auth.
4. Confirm the UAT deployment contains both the new migration and Edge Function.
   The scheduled job first calls authenticated **GET** and requires
   `{ "ready": true, "contractVersion": 2 }`. Old or partially deployed
   UAT workers fail this gate **before** any destructive POST.
5. Run `Scheduled Purge Worker (UAT)` manually with isolated, approved UAT
   fixtures; verify wrong-secret denial, a zero-work response, retry/backoff
   and Storage cleanup. Inspect task counts and files. Never test against production.

**Expected behavior:** missing/mismatched configuration fails the job; wrong
credential returns 401; partial Storage/DB failures return 503 and fail the job.
A zero-item run returns HTTP 200 with zero counts. The worker processes up
to 50 candidates per run, including tasks left in `purging` after a failed
attempt. A held claim token prevents parallel workers from handling the same
task; crashed workers can be reclaimed after a 30-minute lease. Failed items
are deferred using a 1–24-hour bounded exponential backoff so other tasks are
not starved. The response includes `remainingCount` as a backlog indicator.
The worker does not report task IDs, raw exceptions, or keys.

## Failure/recovery

- A task must be claimed with `purge_status='purging'` and a unique claim
  token before deleting files. The token is checked before Storage batches
  and by the final database transaction.
- Claimed tasks cannot be restored; unsuccessful purge attempts remain in Trash
  and are retried after backoff. Multiple independent workers cannot share
  a live claim.
- The worker paginates attachment metadata and removes Storage objects in
  batches of up to 100. Invalid task-scoped object paths block that task's
  deletion and require investigation; do not bypass path checks.
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

## Release gate and verification evidence

This workflow is on the GitHub default branch (`main`) while the UAT
deployment workflow deploys code from `uat`. Merging only to `main` does
**not** deploy the worker or its migration to UAT. Keep the PR Draft until
reviewed; coordinate moving the changes to `uat` via the normal deployment
process. Confirm UAT migration history and the deployed function version
before allowing the schedule to call POST. A contract-version mismatch fails
the scheduled job rather than relying on a green but skipped run.

Local CI verifies exclusive and conflicting claim tokens, backoff eligibility
and a fixture with more than 1,000 attachment metadata records. Real UAT
destructive acceptance remains an operator action, never part of CI.
