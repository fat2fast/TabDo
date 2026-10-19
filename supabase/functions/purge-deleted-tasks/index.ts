import { createClient } from 'jsr:@supabase/supabase-js@2'
import { resolveSupabaseKeys } from '../_shared/supabase-keys.ts'
import { makePurgeResult, validateWorkerSecret, isOwnedObjectPath } from './contract.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-purge-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // 1. Only a dedicated, high-entropy worker credential may authorize deletion.
  const configuredSecret = Deno.env.get('PURGE_WORKER_SECRET')
  if (!configuredSecret || configuredSecret.length < 32 ||
    configuredSecret === Deno.env.get('SUPABASE_SECRET_KEY') ||
    configuredSecret === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    console.error('[PurgeWorker] Dedicated worker credential is missing or invalid.')
    return new Response(
      JSON.stringify({ error: 'Worker configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Do not accept bearer JWTs or privileged Supabase keys as worker credentials.
  if (!validateWorkerSecret(req.headers.get('x-purge-secret'), configuredSecret)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // 2. Resolve service-level Supabase client
  const keysResult = resolveSupabaseKeys()
  if (!keysResult.ok) {
    return new Response(
      JSON.stringify({ error: keysResult.error }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { supabaseUrl, secretKey } = keysResult.keys
  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    // Read-only, authenticated deployment handshake. Missing migration => 503.
    if (req.method === 'GET') {
      const { error } = await adminClient.rpc('purge_due_candidates', { p_limit: 1 })
      return new Response(
        JSON.stringify(error ? { error: 'Worker DB not ready' } : { ready: true, contractVersion: 2 }),
        { status: error ? 503 : 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: candidates, error: candidateErr } = await adminClient.rpc(
      'purge_due_candidates', { p_limit: 50 }
    )
    if (candidateErr) {
      console.error('[PurgeWorker] Failed to query candidates:', candidateErr)
      return new Response(
        JSON.stringify({ error: 'Failed to query purge candidates' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify({ ...makePurgeResult(0, 0, [], 0), contractVersion: 2 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let purgedCount = 0
    const errorCategories: string[] = []
    let skippedCount = 0

    for (const task of candidates) {
      const args = { p_task_id: task.id, p_user_id: task.user_id, p_claim_token: crypto.randomUUID() }
      const defer = async (reason: string) => {
        errorCategories.push(reason)
        const { data, error } = await adminClient.rpc('defer_task_purge', args)
        if (error || !data) errorCategories.push('defer_failed')
      }
      const claimValid = async () => {
        const { data, error } = await adminClient.rpc('is_purge_claim_current', args)
        return !error && data === true
      }
      // Atomically lock + mark as purging before touching Storage.
      // The DB refuses active/restored tasks and prevents a concurrent restore.
      const { data: claimed, error: claimError } = await adminClient.rpc('claim_task_for_purge', args)
      if (claimError) {
        console.error('[PurgeWorker] Task claim failed.')
        errorCategories.push('claim')
        continue
      }
      if (!claimed) {
        skippedCount++
        continue
      }

      // Step A: Clean up Storage objects before deleting database rows
      try {
        // Fetch every metadata row; PostgREST responses are capped by default.
        const attachments: { id: string; bucket: string; kind: string; object_path: string | null }[] = []
        let cursor: string | null = null
        let failedRead = false
        while (true) {
          let query = adminClient.from('task_attachments')
            .select('id, bucket, kind, object_path')
            .eq('task_id', task.id).order('id', { ascending: true }).limit(250)
          if (cursor) query = query.gt('id', cursor)
          const { data: page, error } = await query
          if (error) { failedRead = true; break }
          if (!page?.length) break
          attachments.push(...page)
          cursor = page[page.length - 1].id
          if (page.length < 250) break
        }
        if (failedRead) {
          await defer('attachments_query')
          continue
        }

        if (attachments && attachments.length > 0) {
          const filePaths = attachments
            .filter((a: any) => a.kind === 'file' && a.object_path)
            .map((a: any) => a.object_path)

          if (attachments.some(a => a.kind === 'file' &&
            (a.bucket !== 'task-attachments' || !isOwnedObjectPath(a.object_path, task.user_id, task.id)))) {
            console.error('[PurgeWorker] Attachment path does not belong to task.')
            await defer('invalid_attachment_path')
            continue
          }

          let storageError: string | null = null
          for (let i = 0; i < filePaths.length; i += 100) {
            if (!(await claimValid())) { storageError = 'claim_lost'; break }
            const { error: removeErr } = await adminClient.storage
              .from('task-attachments').remove(filePaths.slice(i, i + 100))
            if (removeErr) { storageError = 'storage_remove'; break }
          }
          if (storageError) {
            await defer(storageError)
            continue
          }

          if (!(await claimValid())) {
            await defer('claim_lost')
            continue
          }

          // Delete attachment metadata rows
          const { error: attDeleteErr } = await adminClient
            .from('task_attachments')
            .delete()
            .eq('task_id', task.id)

          if (attDeleteErr) {
            console.error('[PurgeWorker] Attachment metadata cleanup failed.')
            await defer('attachments_delete')
            continue // Halt purge for this task to retain manifest for retry
          }
        }
      } catch (e: any) {
        console.error('[PurgeWorker] Attachment cleanup exception.')
        await defer('attachments_exception')
        continue // Halt purge for this task to retain manifest for retry
      }

      // Step B: Call database purge function via service_role wrapper ONLY if Step A succeeded completely
      const { data: success, error: purgeErr } = await adminClient.rpc('purge_task_internal', args)

      if (purgeErr) {
        console.error('[PurgeWorker] Database purge failed.')
        await defer('db_purge')
      } else if (success) {
        purgedCount++
      } else {
        await defer('db_purge')
      }
    }

    const { count: remainingCount, error: backlogError } = await adminClient.from('tasks')
      .select('id', { count: 'exact', head: true })
      .not('deleted_at', 'is', null)
      .or(`deleted_at.lte.${new Date(Date.now() - 30 * 86400000).toISOString()},purge_status.in.(pending_purge,purging)`)
    if (backlogError) errorCategories.push('backlog_count')
    const result = { ...makePurgeResult(candidates.length, purgedCount, errorCategories, skippedCount),
      contractVersion: 2, remainingCount: remainingCount ?? null }
    return new Response(
      JSON.stringify(result),
      { status: result.success ? 200 : 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('[PurgeWorker] Unexpected internal error.')
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
