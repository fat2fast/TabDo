import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// 1. Environment Loading
function loadEnvBootstrap() {
  const envPath = path.resolve(process.cwd(), '.env.bootstrap')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim()
        const val = trimmed.slice(eqIdx + 1).trim()
        if (!process.env[key]) {
          process.env[key] = val
        }
      }
    }
  }
}

loadEnvBootstrap()

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

// 2. Preflight Security Check
const isLocalOrTest =
  supabaseUrl.includes('127.0.0.1') ||
  supabaseUrl.includes('localhost') ||
  supabaseUrl.includes('.local')

if (!isLocalOrTest && process.env.ALLOW_PRODUCTION_MIGRATION !== 'true') {
  console.error('[SECURITY PREFLIGHT] Target database appears to be a remote or production environment:')
  console.error(`  SUPABASE_URL: ${supabaseUrl}`)
  console.error('Migration aborted. To authorize rollout on production, set ALLOW_PRODUCTION_MIGRATION=true.')
  process.exit(1)
}

if (!secretKey) {
  console.error('[FAIL] SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required for attachment migration.')
  process.exit(1)
}

const adminClient = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// 3. Constants & Helpers
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
])

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const ATTACHMENTS_REGEX = /<!--\s*tabdo_attachments:\s*(\[[\s\S]*?\])\s*-->/i
const ATTACHMENTS_STRIP_REGEX = /<!--\s*tabdo_attachments:[\s\S]*?-->/gi

function cleanDescriptionWithoutAttachments(desc: string | null | undefined): string {
  if (!desc) return ''
  return desc.replace(ATTACHMENTS_STRIP_REGEX, '').trim()
}

interface LegacyAttachment {
  id?: string
  name: string
  size?: number
  type?: string
  url?: string
  createdAt?: string
}

interface TaskRow {
  id: string
  user_id: string
  title: string
  description: string | null
  updated_at: string
}

// 4. Main Migration Runner
export async function runMigration(options: { apply: boolean }) {
  const modeStr = options.apply ? 'APPLY' : 'DRY-RUN'
  console.log(`=== Task Attachment Migration (${modeStr}) ===`)
  console.log(`Target: ${supabaseUrl}`)

  // Scan tasks with legacy attachments
  const { data: tasks, error: tasksError } = await adminClient
    .from('tasks')
    .select('id, user_id, title, description, updated_at')
    .ilike('description', '%tabdo_attachments:%')

  if (tasksError) {
    console.error('[FAIL] Failed to fetch tasks:', tasksError.message)
    process.exit(1)
  }

  const taskList = (tasks as TaskRow[]) || []
  console.log(`Found ${taskList.length} tasks with legacy attachment tags.`)

  let attachmentsFound = 0
  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const task of taskList) {
    const rawDesc = task.description || ''
    const match = ATTACHMENTS_REGEX.exec(rawDesc)

    if (!match || !match[1]) {
      console.warn(`[SKIP_MALFORMED] Task ${task.id}: Cannot extract attachment payload.`)
      errors++
      continue
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(match[1])
    } catch {
      console.warn(`[SKIP_MALFORMED] Task ${task.id}: Malformed JSON in attachment comment. Preserving description intact.`)
      errors++
      continue
    }

    if (!Array.isArray(parsed)) {
      console.warn(`[SKIP_MALFORMED] Task ${task.id}: Attachment comment is not an array. Preserving description intact.`)
      errors++
      continue
    }

    const legacyList = parsed as LegacyAttachment[]
    attachmentsFound += legacyList.length

    // Fetch existing attachments for this task to ensure idempotency
    const { data: existingRows, error: fetchExistingError } = await adminClient
      .from('task_attachments')
      .select('id, file_name, external_url, checksum, object_path')
      .eq('task_id', task.id)

    if (fetchExistingError) {
      console.error(`[ERROR] Task ${task.id}: Failed to check existing attachments:`, fetchExistingError.message)
      errors++
      continue
    }

    const existingList = existingRows || []
    let taskHasPendingMigration = false
    let taskProcessingFailed = false

    for (const item of legacyList) {
      if (!item || typeof item !== 'object' || !item.name) {
        console.warn(`[SKIP_ITEM] Task ${task.id}: Invalid attachment item object.`)
        skipped++
        continue
      }

      const itemUrl = item.url || ''
      const isLink = item.type === 'link' || itemUrl.startsWith('http://') || itemUrl.startsWith('https://')
      const isDataUrl = itemUrl.startsWith('data:')

      if (isLink) {
        // Link Attachment
        if (!/^https?:\/\/.+/i.test(itemUrl)) {
          console.warn(`[SKIP_INVALID_LINK] Task ${task.id}: Invalid link URL "${itemUrl}"`)
          skipped++
          continue
        }

        const alreadyExists = existingList.some(
          (e) => e.external_url === itemUrl && e.file_name === item.name
        )

        if (alreadyExists) {
          console.log(`[ALREADY_MIGRATED] Task ${task.id}: Link "${item.name}" already in task_attachments.`)
          skipped++
          continue
        }

        taskHasPendingMigration = true
        if (options.apply) {
          const insertPayload = {
            id: crypto.randomUUID(),
            user_id: task.user_id,
            task_id: task.id,
            bucket: 'task-attachments',
            object_path: null,
            file_name: item.name,
            mime_type: null,
            byte_size: null,
            kind: 'link',
            external_url: itemUrl,
            checksum: null,
            upload_status: 'ready',
          }

          const { error: insertError } = await adminClient
            .from('task_attachments')
            .insert(insertPayload)

          if (insertError) {
            console.error(`[ERROR] Task ${task.id}: Failed to insert link metadata:`, insertError.message)
            taskProcessingFailed = true
            errors++
            break
          }
          console.log(`[MIGRATED_LINK] Task ${task.id}: Link "${item.name}" migrated successfully.`)
        } else {
          console.log(`[PLAN_LINK] Task ${task.id}: Would migrate link "${item.name}".`)
        }
        migrated++
      } else if (isDataUrl) {
        // Data URL File Attachment
        const commaIdx = itemUrl.indexOf(',')
        if (commaIdx === -1) {
          console.warn(`[SKIP_MALFORMED_DATA] Task ${task.id}: Missing comma separator in Data URL for "${item.name}".`)
          skipped++
          continue
        }

        const header = itemUrl.slice(0, commaIdx)
        const base64Data = itemUrl.slice(commaIdx + 1)

        // Parse MIME type from header (e.g. data:image/png;base64)
        const mimeMatch = /^data:([^;]+)/i.exec(header)
        const detectedMime = (mimeMatch ? mimeMatch[1] : item.type || '').toLowerCase()

        if (!ALLOWED_MIME_TYPES.has(detectedMime)) {
          console.warn(`[SKIP_UNSUPPORTED_MIME] Task ${task.id}: Unsupported MIME type "${detectedMime}" for "${item.name}".`)
          skipped++
          continue
        }

        let buffer: Buffer
        try {
          buffer = Buffer.from(base64Data, 'base64')
        } catch {
          console.warn(`[SKIP_CORRUPT_BASE64] Task ${task.id}: Base64 decoding failed for "${item.name}".`)
          skipped++
          continue
        }

        const byteSize = buffer.length
        if (byteSize > MAX_FILE_SIZE) {
          console.warn(`[SKIP_TOO_LARGE] Task ${task.id}: File "${item.name}" (${byteSize} B) exceeds 10MB limit.`)
          skipped++
          continue
        }

        const checksum = crypto.createHash('sha256').update(buffer).digest('hex')
        const alreadyExists = existingList.some(
          (e) => e.checksum === checksum || e.file_name === item.name
        )

        if (alreadyExists) {
          console.log(`[ALREADY_MIGRATED] Task ${task.id}: File "${item.name}" already in task_attachments.`)
          skipped++
          continue
        }

        taskHasPendingMigration = true
        const sanitizedFileName = item.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val))
        const attachmentId = isUuid(item.id) ? item.id! : crypto.randomUUID()
        const objectPath = `${task.user_id}/${task.id}/${attachmentId}_${sanitizedFileName}`

        if (options.apply) {
          // 1. Upload file object to private bucket
          const { error: uploadError } = await adminClient.storage
            .from('task-attachments')
            .upload(objectPath, buffer, {
              contentType: detectedMime,
              upsert: true,
            })

          if (uploadError) {
            console.error(`[ERROR] Task ${task.id}: Storage upload failed for "${item.name}":`, uploadError.message)
            taskProcessingFailed = true
            errors++
            break
          }

          // 2. Insert metadata row
          const insertPayload = {
            id: attachmentId,
            user_id: task.user_id,
            task_id: task.id,
            bucket: 'task-attachments',
            object_path: objectPath,
            file_name: item.name,
            mime_type: detectedMime,
            byte_size: byteSize,
            kind: 'file',
            external_url: null,
            checksum,
            upload_status: 'ready',
          }

          const { error: insertError } = await adminClient
            .from('task_attachments')
            .insert(insertPayload)

          if (insertError) {
            console.error(`[ERROR] Task ${task.id}: Metadata insert failed for "${item.name}":`, insertError.message)
            taskProcessingFailed = true
            errors++
            break
          }
          console.log(`[MIGRATED_FILE] Task ${task.id}: File "${item.name}" (${byteSize} B) migrated to Storage.`)
        } else {
          console.log(`[PLAN_FILE] Task ${task.id}: Would upload "${item.name}" (${byteSize} B) to Storage path "${objectPath}".`)
        }
        migrated++
      } else {
        console.warn(`[SKIP_UNKNOWN] Task ${task.id}: Unknown attachment payload format for "${item.name}".`)
        skipped++
      }
    }

    // Clean description comment after successful migration of attachments
    const allItemsMigratedOrExisting = !taskProcessingFailed && (taskHasPendingMigration || (existingList.length > 0 && legacyList.length > 0))
    if (options.apply && allItemsMigratedOrExisting) {
      const cleanedDesc = cleanDescriptionWithoutAttachments(rawDesc)
      const { error: updateError } = await adminClient
        .from('tasks')
        .update({
          description: cleanedDesc || null,
        })
        .eq('id', task.id)

      if (updateError) {
        console.error(`[ERROR] Task ${task.id}: Failed to update description without attachments:`, updateError.message)
        errors++
      } else {
        console.log(`[CLEANED_DESC] Task ${task.id}: Description cleaned of legacy metadata comment.`)
      }
    } else if (!options.apply && taskHasPendingMigration) {
      console.log(`[PLAN_CLEAN_DESC] Task ${task.id}: Would clean legacy metadata comment from description.`)
    }
  }

  console.log('\n========================================')
  console.log('Task Attachment Migration Summary')
  console.log(`Mode: ${modeStr}`)
  console.log(`Tasks scanned: ${taskList.length}`)
  console.log(`Attachments found: ${attachmentsFound}`)
  console.log(`migrated=${migrated}`)
  console.log(`skipped=${skipped}`)
  console.log(`errors=${errors}`)
  console.log('========================================')

  return { tasksScanned: taskList.length, attachmentsFound, migrated, skipped, errors }
}

// 5. CLI Entrypoint
if (process.argv[1] && process.argv[1].endsWith('migrate-task-attachments.ts')) {
  const args = process.argv.slice(2)
  const isApply = args.includes('--apply')
  const isDryRun = args.includes('--dry-run') || !isApply

  runMigration({ apply: isApply && !args.includes('--dry-run') })
    .then((result) => {
      if (result.errors > 0) {
        console.warn(`[WARN] Migration finished with ${result.errors} errors.`)
      }
      process.exit(0)
    })
    .catch((err) => {
      console.error('[FATAL] Unhandled migration error:', err)
      process.exit(1)
    })
}
