import { createClient } from 'jsr:@supabase/supabase-js@2'
import { resolveSupabaseKeys } from '../_shared/supabase-keys.ts'
import { makePurgeResult, validateWorkerSecret } from './contract.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-purge-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
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
    // 3. Find candidates for purge: expired tasks (>= 30 days) or tasks with explicit purge_status = 'pending_purge'
    const retentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: candidates, error: candidateErr } = await adminClient
      .from('tasks')
      .select('id, user_id')
      .not('deleted_at', 'is', null)
      .or(`deleted_at.lte.${retentionCutoff},purge_status.in.(pending_purge,purging)`)
      .order('deleted_at', { ascending: true })
      .limit(50)

    if (candidateErr) {
      console.error('[PurgeWorker] Failed to query candidates:', candidateErr)
      return new Response(
        JSON.stringify({ error: 'Failed to query purge candidates' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify(makePurgeResult(0, 0, [], 0)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let purgedCount = 0
    const errorCategories: string[] = []
    let skippedCount = 0

    for (const task of candidates) {
      // Atomically lock + mark as purging before touching Storage.
      // The DB refuses active/restored tasks and prevents a concurrent restore.
      const { data: claimed, error: claimError } = await adminClient.rpc('claim_task_for_purge', {
        p_task_id: task.id,
        p_user_id: task.user_id,
      })
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
        const { data: attachments, error: attSelectErr } = await adminClient
          .from('task_attachments')
          .select('id, object_path, kind')
          .eq('task_id', task.id)

        if (attSelectErr) {
          console.error('[PurgeWorker] Attachment query failed.')
          errorCategories.push('attachments_query')
          continue // Halt purge for this task to retain manifest for retry
        }

        if (attachments && attachments.length > 0) {
          const filePaths = attachments
            .filter((a: any) => a.kind === 'file' && a.object_path)
            .map((a: any) => a.object_path)

          if (filePaths.length > 0) {
            const { error: removeErr } = await adminClient.storage
              .from('task-attachments')
              .remove(filePaths)

            if (removeErr) {
              console.error('[PurgeWorker] Storage cleanup failed.')
              errorCategories.push('storage_remove')
              continue // Halt purge for this task to retain manifest for retry
            }
          }

          // Delete attachment metadata rows
          const { error: attDeleteErr } = await adminClient
            .from('task_attachments')
            .delete()
            .eq('task_id', task.id)

          if (attDeleteErr) {
            console.error('[PurgeWorker] Attachment metadata cleanup failed.')
            errorCategories.push('attachments_delete')
            continue // Halt purge for this task to retain manifest for retry
          }
        }
      } catch (e: any) {
        console.error('[PurgeWorker] Attachment cleanup exception.')
        errorCategories.push('attachments_exception')
        continue // Halt purge for this task to retain manifest for retry
      }

      // Step B: Call database purge function via service_role wrapper ONLY if Step A succeeded completely
      const { data: success, error: purgeErr } = await adminClient.rpc('purge_task_internal', {
        p_task_id: task.id,
        p_user_id: task.user_id,
      })

      if (purgeErr) {
        console.error('[PurgeWorker] Database purge failed.')
        errorCategories.push('db_purge')
      } else if (success) {
        purgedCount++
      } else {
        errorCategories.push('db_purge')
      }
    }

    const result = makePurgeResult(candidates.length, purgedCount, errorCategories, skippedCount)
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
