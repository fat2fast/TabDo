import { createClient } from 'jsr:@supabase/supabase-js@2'
import { resolveSupabaseKeys } from '../_shared/supabase-keys.ts'

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

  // 1. Verify trusted invocation secret
  const configuredSecret =
    Deno.env.get('PURGE_WORKER_SECRET') ||
    Deno.env.get('CRON_SECRET') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    Deno.env.get('SUPABASE_SECRET_KEY')
  if (!configuredSecret) {
    console.error('[PurgeWorker] Configuration error: PURGE_WORKER_SECRET or CRON_SECRET is not configured.')
    return new Response(
      JSON.stringify({ error: 'Server configuration error: missing worker secret' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const authHeader = req.headers.get('Authorization')
  const customHeader = req.headers.get('x-purge-secret')
  const providedSecret = customHeader || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null)

  if (!providedSecret || providedSecret !== configuredSecret) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: missing or invalid worker secret' }),
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
      .select('id, user_id, deletion_batch_id')
      .or(`deleted_at.lte.${retentionCutoff},purge_status.eq.pending_purge`)
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
        JSON.stringify({ success: true, purgedCount: 0, message: 'No tasks eligible for purge' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let purgedCount = 0
    const taskErrors: any[] = []

    for (const task of candidates) {
      // Step A: If task_attachments table exists, clean up storage objects first
      try {
        const { data: attachments, error: attSelectErr } = await adminClient
          .from('task_attachments')
          .select('id, object_path, kind')
          .eq('task_id', task.id)

        if (attSelectErr) {
          console.error(`[PurgeWorker] Querying attachments failed for task ${task.id}:`, attSelectErr)
          taskErrors.push({ taskId: task.id, step: 'attachments_query', error: attSelectErr.message })
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
              console.error(`[PurgeWorker] Storage cleanup failed for task ${task.id}:`, removeErr)
              taskErrors.push({ taskId: task.id, step: 'storage_remove', error: removeErr.message })
              continue // Halt purge for this task to retain manifest for retry
            }
          }

          // Delete attachment metadata rows
          const { error: attDeleteErr } = await adminClient
            .from('task_attachments')
            .delete()
            .eq('task_id', task.id)

          if (attDeleteErr) {
            console.error(`[PurgeWorker] Deleting attachment metadata failed for task ${task.id}:`, attDeleteErr)
            taskErrors.push({ taskId: task.id, step: 'attachments_delete', error: attDeleteErr.message })
            continue // Halt purge for this task to retain manifest for retry
          }
        }
      } catch (e: any) {
        console.error(`[PurgeWorker] Attachment cleanup exception for task ${task.id}:`, e)
        taskErrors.push({ taskId: task.id, step: 'attachments_exception', error: e?.message })
        continue // Halt purge for this task to retain manifest for retry
      }

      // Step B: Call database purge function via service_role wrapper ONLY if Step A succeeded completely
      const { data: success, error: purgeErr } = await adminClient.rpc('purge_task_internal', {
        p_task_id: task.id,
        p_user_id: task.user_id,
      })

      if (purgeErr) {
        console.error(`[PurgeWorker] Database purge failed for task ${task.id}:`, purgeErr)
        taskErrors.push({ taskId: task.id, step: 'db_purge', error: purgeErr.message })
      } else if (success) {
        purgedCount++
      } else {
        taskErrors.push({ taskId: task.id, step: 'db_purge', error: 'purge returned false' })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        purgedCount,
        processedCount: candidates.length,
        errors: taskErrors,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('[PurgeWorker] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
