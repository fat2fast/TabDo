import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function validateLocalSupabaseStatus(statusJsonRaw: string): { apiUrl: string; dbUrl: string } {
  const firstBrace = statusJsonRaw.indexOf('{')
  const lastBrace = statusJsonRaw.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Invalid output from supabase status: JSON block not found')
  }

  const jsonStr = statusJsonRaw.slice(firstBrace, lastBrace + 1)
  let status: Record<string, unknown>
  try {
    status = JSON.parse(jsonStr)
  } catch (err) {
    throw new Error(`Failed to parse supabase status JSON: ${err instanceof Error ? err.message : String(err)}`)
  }

  const apiUrlRaw = status.API_URL
  const dbUrlRaw = status.DB_URL

  if (typeof apiUrlRaw !== 'string' || !apiUrlRaw) {
    throw new Error('Supabase status missing API_URL')
  }
  if (typeof dbUrlRaw !== 'string' || !dbUrlRaw) {
    throw new Error('Supabase status missing DB_URL')
  }

  const apiUrl = new URL(apiUrlRaw)
  if (apiUrl.hostname !== '127.0.0.1' && apiUrl.hostname !== 'localhost') {
    throw new Error(`Refusing to reset non-loopback API host: ${apiUrl.hostname}`)
  }
  if (apiUrl.port !== '54321') {
    throw new Error(`Unexpected local API port: ${apiUrl.port} (expected 54321)`)
  }

  const dbUrl = new URL(dbUrlRaw)
  if (dbUrl.hostname !== '127.0.0.1' && dbUrl.hostname !== 'localhost') {
    throw new Error(`Refusing to reset non-loopback DB host: ${dbUrl.hostname}`)
  }
  if (dbUrl.port !== '54322') {
    throw new Error(`Unexpected local DB port: ${dbUrl.port} (expected 54322)`)
  }

  return { apiUrl: apiUrlRaw, dbUrl: dbUrlRaw }
}

export async function runResetLocalDb(): Promise<void> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(scriptDir, '..')

  console.log('[reset-local-db] Preflight: checking local Supabase stack...')
  const statusRes = spawnSync('supabase', ['status', '-o', 'json'], {
    cwd: repoRoot,
    encoding: 'utf-8',
  })

  if (statusRes.status !== 0 || !statusRes.stdout) {
    console.error('[reset-local-db] Preflight failed: local Supabase is not running.')
    if (statusRes.stderr) {
      console.error(statusRes.stderr.trim())
    }
    process.exit(1)
  }

  try {
    const verified = validateLocalSupabaseStatus(statusRes.stdout)
    console.log(`[reset-local-db] Verified local stack (API: ${verified.apiUrl}, DB port: 54322)`)
  } catch (err) {
    console.error(`[reset-local-db] Preflight verification failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  const resetArgs = ['db', 'reset', '--local', '--sql-paths', './seeds/local-demo.sql']
  console.log(`[reset-local-db] Running: supabase ${resetArgs.join(' ')}`)

  const resetRes = spawnSync('supabase', resetArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
  })

  if (resetRes.status !== 0) {
    console.error(`[reset-local-db] Reset failed with exit code ${resetRes.status}`)
    process.exit(resetRes.status ?? 1)
  }

  console.log('[reset-local-db] Database reset and local demo seed completed successfully.')

  // Automatically configure passwords for admin and user seed accounts
  console.log('[reset-local-db] Automatically setting local seed passwords...')
  try {
    const seedScriptPath = './set-local-seed-passwords.ts'
    const { setLocalSeedPasswords } = await import(seedScriptPath)
    await setLocalSeedPasswords()
  } catch (err) {
    console.error(`[reset-local-db] Failed to set seed account passwords: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runResetLocalDb().catch((err) => {
    console.error(`[reset-local-db] Unhandled error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
