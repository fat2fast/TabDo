import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

// Optional loading of .env.bootstrap if it exists
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

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = process.env.TABDO_ADMIN_EMAIL
const adminPassword = process.env.TABDO_ADMIN_PASSWORD

if (!supabaseUrl || !serviceRoleKey || !adminEmail || !adminPassword) {
  console.error('Error: Missing required environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TABDO_ADMIN_EMAIL, TABDO_ADMIN_PASSWORD)')
  process.exit(1)
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function findUserByEmail(email: string) {
  let page = 1
  const perPage = 50
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Failed to list users: ${error.message}`)
    if (!data.users || data.users.length === 0) break
    const found = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < perPage) break
    page++
  }
  return null
}

async function main() {
  try {
    let existingUser = await findUserByEmail(adminEmail)
    let isCreated = false

    if (!existingUser) {
      const { data, error } = await adminClient.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          displayName: 'Admin'
        }
      })
      if (error) {
        throw new Error(`Failed to create admin auth user: ${error.message}`)
      }
      existingUser = data.user
      isCreated = true
    }

    if (!existingUser) {
      throw new Error('Admin user could not be found or created')
    }

    // Check or update profile role
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, display_name')
      .eq('id', existingUser.id)
      .maybeSingle()

    if (profileError) {
      throw new Error(`Failed to query admin profile: ${profileError.message}`)
    }

    if (!profile) {
      await adminClient.from('profiles').upsert({
        id: existingUser.id,
        role: 'admin',
        display_name: 'Admin'
      })
    } else if (profile.role !== 'admin') {
      await adminClient.from('profiles').update({ role: 'admin' }).eq('id', existingUser.id)
    }

    if (isCreated) {
      console.log(`Admin account provisioned and verified: ${adminEmail}`)
    } else {
      console.log(`admin verified: ${adminEmail}`)
    }
    process.exit(0)
  } catch (err: any) {
    let msg = err?.message || 'Unknown error'
    if (serviceRoleKey) msg = msg.replaceAll(serviceRoleKey, '[REDACTED]')
    if (adminPassword) msg = msg.replaceAll(adminPassword, '[REDACTED]')
    console.error(`Bootstrap failed: ${msg}`)
    process.exit(1)
  }
}

main()
