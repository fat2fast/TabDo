import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

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

export function validateLocalUrl(urlStr: string): void {
  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    throw new Error(`Invalid URL: ${urlStr}`)
  }
  if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
    throw new Error(`Refusing non-local host: ${parsed.hostname}. Seed password operations are strictly local.`)
  }
}

const DEFAULT_LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

export async function setLocalSeedPasswords(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
  validateLocalUrl(supabaseUrl)

  const secretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    DEFAULT_LOCAL_SERVICE_KEY

  const adminPassword = process.env.TABDO_LOCAL_ADMIN_PASSWORD || 'Admin12345!'
  const userPassword = process.env.TABDO_LOCAL_USER_PASSWORD || 'User12345!'

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const adminId = '11111111-1111-4111-8111-111111111111'
  const userId = '22222222-2222-4222-8222-222222222222'

  console.log('[seed:local:accounts] Setting local passwords for seed accounts via Admin API...')

  const { error: errAdmin } = await adminClient.auth.admin.updateUserById(adminId, {
    password: adminPassword,
    email_confirm: true,
  })
  if (errAdmin) {
    throw new Error(`Failed to set password for admin seed account: ${errAdmin.message}`)
  }

  const { error: errUser } = await adminClient.auth.admin.updateUserById(userId, {
    password: userPassword,
    email_confirm: true,
  })
  if (errUser) {
    throw new Error(`Failed to set password for user seed account: ${errUser.message}`)
  }

  console.log('[seed:local:accounts] Successfully configured local passwords for admin and user seed accounts.')
  console.log('----------------------------------------------------------------------')
  console.log('  Tài khoản đăng nhập môi trường local demo:')
  console.log('  1. Người dùng thường (Regular User):')
  console.log('     - Email:    user.demo@tabdo.local')
  console.log(`     - Mật khẩu: ${userPassword}`)
  console.log('  2. Quản trị viên (Admin):')
  console.log('     - Email:    admin.demo@tabdo.local')
  console.log(`     - Mật khẩu: ${adminPassword}`)
  console.log('----------------------------------------------------------------------')
}

if (process.argv[1]?.endsWith('set-local-seed-passwords.ts')) {
  setLocalSeedPasswords().catch((err) => {
    console.error(`[seed:local:accounts] Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
