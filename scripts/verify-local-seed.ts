import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { validateLocalUrl } from './set-local-seed-passwords.ts'

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

const DEFAULT_LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export async function verifyLocalSeed(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
  validateLocalUrl(supabaseUrl)

  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_LOCAL_ANON_KEY

  const adminPassword = process.env.TABDO_LOCAL_ADMIN_PASSWORD || 'Admin12345!'
  const userPassword = process.env.TABDO_LOCAL_USER_PASSWORD || 'User12345!'

  const adminEmail = 'admin.demo@tabdo.local'
  const userEmail = 'user.demo@tabdo.local'
  const adminId = '11111111-1111-4111-8111-111111111111'
  const userId = '22222222-2222-4222-8222-222222222222'

  // 1. Client for Admin sign-in
  const adminClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: adminAuth, error: adminAuthErr } = await adminClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })
  if (adminAuthErr || !adminAuth.session) {
    throw new Error(`Admin login failed: ${adminAuthErr?.message}`)
  }
  if (adminAuth.user.id !== adminId) {
    throw new Error(`Admin user ID mismatch: expected ${adminId}, got ${adminAuth.user.id}`)
  }

  // Verify Admin profile
  const { data: adminProfile, error: adminProfErr } = await adminClient
    .from('profiles')
    .select('role, is_active, timezone')
    .eq('id', adminId)
    .single()
  if (adminProfErr || !adminProfile) {
    throw new Error(`Failed to load admin profile: ${adminProfErr?.message}`)
  }
  if (adminProfile.role !== 'admin') {
    throw new Error(`Admin profile role mismatch: expected admin, got ${adminProfile.role}`)
  }

  // Verify Admin tasks and schedules
  const { count: adminTaskCount, error: adminTasksErr } = await adminClient
    .from('tasks')
    .select('id', { count: 'exact', head: true })
  if (adminTasksErr) {
    throw new Error(`Admin tasks query failed: ${adminTasksErr.message}`)
  }
  if ((adminTaskCount ?? 0) < 105) {
    throw new Error(`Admin tasks count too low: expected >= 105, got ${adminTaskCount}`)
  }

  const { count: adminSchedCount, error: adminSchedErr } = await adminClient
    .from('schedule_blocks')
    .select('id', { count: 'exact', head: true })
  if (adminSchedErr) {
    throw new Error(`Admin schedules query failed: ${adminSchedErr.message}`)
  }
  if ((adminSchedCount ?? 0) < 20) {
    throw new Error(`Admin schedules count too low: expected >= 20, got ${adminSchedCount}`)
  }

  // 2. Client for Regular User sign-in
  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userAuth, error: userAuthErr } = await userClient.auth.signInWithPassword({
    email: userEmail,
    password: userPassword,
  })
  if (userAuthErr || !userAuth.session) {
    throw new Error(`User login failed: ${userAuthErr?.message}`)
  }
  if (userAuth.user.id !== userId) {
    throw new Error(`User user ID mismatch: expected ${userId}, got ${userAuth.user.id}`)
  }

  // Verify User profile
  const { data: userProfile, error: userProfErr } = await userClient
    .from('profiles')
    .select('role, is_active, timezone')
    .eq('id', userId)
    .single()
  if (userProfErr || !userProfile) {
    throw new Error(`Failed to load user profile: ${userProfErr?.message}`)
  }
  if (userProfile.role !== 'user') {
    throw new Error(`User profile role mismatch: expected user, got ${userProfile.role}`)
  }

  // Verify User tasks and schedules
  const { count: userTaskCount, error: userTasksErr } = await userClient
    .from('tasks')
    .select('id', { count: 'exact', head: true })
  if (userTasksErr) {
    throw new Error(`User tasks query failed: ${userTasksErr.message}`)
  }
  if ((userTaskCount ?? 0) < 20) {
    throw new Error(`User tasks count too low: expected >= 20, got ${userTaskCount}`)
  }

  const { count: userSchedCount, error: userSchedErr } = await userClient
    .from('schedule_blocks')
    .select('id', { count: 'exact', head: true })
  if (userSchedErr) {
    throw new Error(`User schedules query failed: ${userSchedErr.message}`)
  }
  if ((userSchedCount ?? 0) < 8) {
    throw new Error(`User schedules count too low: expected >= 8, got ${userSchedCount}`)
  }

  // 3. Cross-User Privacy & RLS Isolation Tests
  // User cannot read Admin's tasks
  const { data: adminTasksSeenByUser, error: crossErr1 } = await userClient
    .from('tasks')
    .select('id')
    .eq('user_id', adminId)
  if (crossErr1) {
    throw new Error(`Query failed unexpectedly: ${crossErr1.message}`)
  }
  if (adminTasksSeenByUser && adminTasksSeenByUser.length > 0) {
    throw new Error(`Privacy breach: Regular user saw ${adminTasksSeenByUser.length} admin tasks!`)
  }

  // Admin cannot read User's personal tasks (personal records are strictly owner-scoped)
  const { data: userTasksSeenByAdmin, error: crossErr2 } = await adminClient
    .from('tasks')
    .select('id')
    .eq('user_id', userId)
  if (crossErr2) {
    throw new Error(`Query failed unexpectedly: ${crossErr2.message}`)
  }
  if (userTasksSeenByAdmin && userTasksSeenByAdmin.length > 0) {
    throw new Error(`Privacy breach: Admin saw ${userTasksSeenByAdmin.length} user personal tasks!`)
  }

  // User cannot update Admin's task
  const { data: userUpdateAdminTask } = await userClient
    .from('tasks')
    .update({ title: 'Tampered Title' })
    .eq('user_id', adminId)
    .select()
  if (userUpdateAdminTask && userUpdateAdminTask.length > 0) {
    throw new Error('Privacy breach: Regular user managed to update admin task!')
  }

  // User cannot read Admin's schedule blocks
  const { data: adminSchedulesSeenByUser } = await userClient
    .from('schedule_blocks')
    .select('id')
    .eq('user_id', adminId)
  if (adminSchedulesSeenByUser && adminSchedulesSeenByUser.length > 0) {
    throw new Error('Privacy breach: Regular user saw admin schedule blocks!')
  }

  // Admin cannot update User's schedule block
  const { data: adminUpdateUserSched } = await adminClient
    .from('schedule_blocks')
    .update({ title: 'Tampered Title' })
    .eq('user_id', userId)
    .select()
  if (adminUpdateUserSched && adminUpdateUserSched.length > 0) {
    throw new Error('Privacy breach: Admin managed to update user schedule block!')
  }

  console.log('[seed:local:verify] 2 signed-in users; cross-user tasks and schedules denied')
}

if (process.argv[1]?.endsWith('verify-local-seed.ts')) {
  verifyLocalSeed().catch((err) => {
    console.error(`[seed:local:verify] Verification failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
