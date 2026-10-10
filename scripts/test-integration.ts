import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'

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
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!secretKey) {
  console.error('[FAIL] SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required for integration tests.')
  console.error('Configure SUPABASE_SECRET_KEY in .env.bootstrap or the process environment.')
  console.error('Missing prerequisites are a failure condition, not a skipped pass.')
  process.exit(1)
}

const adminClient = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const anonClient = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const itRunId = Date.now().toString(36)
const testUsers = {
  userA: {
    email: `it_user_a_${itRunId}@tabdo.local`,
    password: 'Password123!',
    displayName: 'IT User A',
    id: '',
    token: ''
  },
  userB: {
    email: `it_user_b_${itRunId}@tabdo.local`,
    password: 'Password123!',
    displayName: 'IT User B',
    id: '',
    token: ''
  },
  admin: {
    email: `it_admin_${itRunId}@tabdo.local`,
    password: 'Password123!',
    displayName: 'IT Admin',
    id: '',
    token: ''
  },
  provisioned: {
    email: `it_provisioned_${itRunId}@tabdo.local`,
    password: 'Password123!',
    displayName: 'IT Provisioned Worker',
    id: ''
  }
}

const spawnedFunctionProcs: ChildProcess[] = []

async function isFunctionRunning(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(1500) })
    return res.status === 405 || res.status === 401 || res.status === 403 || res.status === 200
  } catch {
    return false
  }
}

async function ensureFunctionServing(functionName: string, functionUrl: string): Promise<void> {
  const ready = await isFunctionRunning(functionUrl)
  if (ready) {
    console.log(`✓ Edge Function ${functionName} is already responding.`)
    return
  }

  console.log(`Starting local Edge Function runner for ${functionName}...`)
  const proc = spawn('supabase', ['functions', 'serve', functionName, '--no-verify-jwt'], {
    stdio: 'ignore',
    detached: false
  })

  proc.on('error', (err) => {
    console.warn(`Could not spawn supabase functions serve ${functionName}: ${err.message}`)
  })
  spawnedFunctionProcs.push(proc)

  // Wait up to 10 seconds for the function to respond
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500))
    if (await isFunctionRunning(functionUrl)) {
      console.log(`✓ Local Edge Function server ready for ${functionName}.`)
      return
    }
  }

  throw new Error(`Edge Function at ${functionUrl} did not become ready.`)
}

async function cleanupUser(id: string) {
  if (!id) return
  try {
    await adminClient.auth.admin.deleteUser(id)
  } catch {
    // ignore cleanup errors
  }
}

async function runIntegration() {
  console.log('--- Starting TabDo Integration & Security Test Suite ---')
  let createdTaskId = ''
  let exitCode = 0

  try {
    // 1. Database connectivity check
    console.log('[1/5] Verifying database connectivity & migrations...')
    const { error: dbError } = await adminClient.from('profiles').select('id').limit(1)
    if (dbError) {
      throw new Error(`Database connection failed: ${dbError.message}`)
    }
    console.log('✓ Database connected and tables accessible.')

    // 2. Provision test users
    console.log('[2/5] Provisioning test users and sessions...')
    for (const key of ['userA', 'userB', 'admin'] as const) {
      const u = testUsers[key]
      const { data: created, error: cErr } = await adminClient.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { displayName: u.displayName }
      })
      if (cErr || !created.user) {
        throw new Error(`Failed to create test user ${u.email}: ${cErr?.message}`)
      }
      u.id = created.user.id

      if (key === 'admin') {
        const { error: rErr } = await adminClient.from('profiles').update({ role: 'admin' }).eq('id', u.id)
        if (rErr) throw new Error(`Failed to elevate test admin profile: ${rErr.message}`)
      }

      // Obtain JWT session token
      const { data: authData, error: aErr } = await anonClient.auth.signInWithPassword({
        email: u.email,
        password: u.password
      })
      if (aErr || !authData.session?.access_token) {
        throw new Error(`Failed to authenticate ${u.email}: ${aErr?.message}`)
      }
      u.token = authData.session.access_token
    }

    // Verify public self-registration is prohibited (P0 & P2 security requirement)
    console.log('Verifying public self-registration is disabled with fresh unauthenticated client...')
    const freshAnonClient = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const publicAttemptEmail = `it_public_${itRunId}@tabdo.local`
    const { data: signUpData, error: signUpError } = await freshAnonClient.auth.signUp({
      email: publicAttemptEmail,
      password: 'Password123!',
    })

    if (!signUpError) {
      throw new Error('Public self-registration must be disabled, but signUp succeeded without error!')
    }
    const errText = signUpError.message.toLowerCase()
    if (!errText.includes('signup') && !errText.includes('not allowed') && !errText.includes('disabled')) {
      throw new Error(`Expected public signup rejection message, but got: "${signUpError.message}"`)
    }

    // Explicitly verify that no unauthorized user or profile was created in the database
    const { data: listedUsers } = await adminClient.auth.admin.listUsers()
    const leakedUser = listedUsers?.users.find((u) => u.email === publicAttemptEmail)
    if (leakedUser) {
      await adminClient.auth.admin.deleteUser(leakedUser.id)
      throw new Error(`Security Violation: Unauthorized account was created in auth.users despite disabled signup!`)
    }
    const { data: leakedProfiles } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', (signUpData as any)?.user?.id || 'none')
    if (leakedProfiles && leakedProfiles.length > 0) {
      throw new Error(`Security Violation: Profile row created for rejected signup!`)
    }
    console.log('✓ Public self-registration is prohibited and verified (no account created).')

    // Verify User A profile trigger created role 'user'
    const { data: profileA, error: pAErr } = await adminClient
      .from('profiles')
      .select('id, role, display_name')
      .eq('id', testUsers.userA.id)
      .single()
    if (pAErr || profileA?.role !== 'user') {
      throw new Error(`Trigger failed: expected User A role 'user', got ${profileA?.role}`)
    }
    console.log('✓ Test users provisioned and profile trigger verified.')

    // 3. Test RLS Personal-Data Owner Isolation & Role Immutability
    console.log('[3/5] Testing RLS Owner Isolation & Role Immutability...')
    const userAClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${testUsers.userA.token}` } },
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const userBClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${testUsers.userB.token}` } },
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const adminUserClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${testUsers.admin.token}` } },
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // User A inserts task
    const { data: taskA, error: taskAErr } = await userAClient
      .from('tasks')
      .insert({
        user_id: testUsers.userA.id,
        title: 'User A Secret Task',
        status: 'todo',
        priority: 'high'
      })
      .select()
      .single()
    if (taskAErr || !taskA) {
      throw new Error(`User A failed to insert task: ${taskAErr?.message}`)
    }
    createdTaskId = taskA.id

    // User B cannot insert a task claiming User A's user_id
    const { error: forgedInsertErr } = await userBClient
      .from('tasks')
      .insert({
        user_id: testUsers.userA.id,
        title: 'Forged Task',
        status: 'todo',
        priority: 'low'
      })
    if (!forgedInsertErr) {
      throw new Error(`RLS Violation: User B was able to insert a task with User A's user_id!`)
    }

    // User A can read own task
    const { data: readA, error: rAErr } = await userAClient
      .from('tasks')
      .select('*')
      .eq('id', createdTaskId)
    if (rAErr || readA.length !== 1) {
      throw new Error(`User A could not read own task: ${rAErr?.message}`)
    }

    // User B cannot read User A's task
    const { data: readB, error: rBErr } = await userBClient
      .from('tasks')
      .select('*')
      .eq('id', createdTaskId)
    if (rBErr || (readB && readB.length > 0)) {
      throw new Error(`RLS Violation: User B was able to read User A's task!`)
    }

    // User B cannot update User A's task
    const { data: updateB } = await userBClient
      .from('tasks')
      .update({ title: 'Hacked by B' })
      .eq('id', createdTaskId)
      .select()
    if (updateB && updateB.length > 0) {
      throw new Error(`RLS Violation: User B was able to update User A's task!`)
    }

    // User B cannot delete User A's task
    const { data: deleteB } = await userBClient
      .from('tasks')
      .delete()
      .eq('id', createdTaskId)
      .select()
    if (deleteB && deleteB.length > 0) {
      throw new Error(`RLS Violation: User B was able to delete User A's task!`)
    }

    // Admin user cannot read User A's personal task via client API
    const { data: readAdmin, error: rAdminErr } = await adminUserClient
      .from('tasks')
      .select('*')
      .eq('id', createdTaskId)
    if (rAdminErr || (readAdmin && readAdmin.length > 0)) {
      throw new Error(`RLS Boundary Violation: Admin user role bypassed owner isolation on personal tasks!`)
    }

    // User A cannot escalate role to admin directly
    await userAClient.from('profiles').update({ role: 'admin' }).eq('id', testUsers.userA.id)
    const { data: profileCheckA } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', testUsers.userA.id)
      .single()
    if (profileCheckA?.role !== 'user') {
      throw new Error(`Security Violation: User A was able to escalate their profile role to admin!`)
    }

    // Scoped RPC update_my_profile updates display name and preserves user role
    const { data: rpcRes, error: rpcErr } = await userAClient
      .rpc('update_my_profile', { new_display_name: 'User A Updated' })
    if (rpcErr || rpcRes?.display_name !== 'User A Updated' || rpcRes?.role !== 'user') {
      throw new Error(`update_my_profile RPC failed or mutated role: ${rpcErr?.message}`)
    }
    console.log('✓ Personal-data owner isolation, admin boundary, and role immutability verified.')

    // 4. Test Edge Function admin-create-user
    console.log('[4/5] Testing Edge Function admin-create-user authorization & status codes...')
    const functionUrl = `${supabaseUrl}/functions/v1/admin-create-user`
    await ensureFunctionServing('admin-create-user', functionUrl)

    // Test 401: Unauthorized (no auth header)
    const res401 = await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test401@tabdo.local', initialPassword: 'Password123!' })
    })
    if (res401.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for unauthenticated request, got ${res401.status}`)
    }

    // Test 403: Forbidden (non-admin user)
    const res403 = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUsers.userA.token}`
      },
      body: JSON.stringify({ email: 'test403@tabdo.local', initialPassword: 'Password123!' })
    })
    if (res403.status !== 403) {
      throw new Error(`Expected 403 Forbidden for non-admin caller, got ${res403.status}`)
    }

    // Test 400: Bad Request (null body)
    const res400Null = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUsers.admin.token}`
      },
      body: 'null'
    })
    if (res400Null.status !== 400) {
      throw new Error(`Expected 400 Bad Request for null body, got ${res400Null.status}`)
    }

    // Test 400: Bad Request (password < 8)
    const res400Short = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUsers.admin.token}`
      },
      body: JSON.stringify({ email: 'valid@tabdo.local', initialPassword: 'short' })
    })
    if (res400Short.status !== 400) {
      throw new Error(`Expected 400 Bad Request for short password, got ${res400Short.status}`)
    }

    // Test 201: Created (valid admin call)
    const res201 = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUsers.admin.token}`
      },
      body: JSON.stringify({
        email: testUsers.provisioned.email,
        initialPassword: testUsers.provisioned.password,
        displayName: testUsers.provisioned.displayName
      })
    })
    if (res201.status !== 201) {
      const errText = await res201.text()
      throw new Error(`Expected 201 Created for valid provisioning, got ${res201.status}: ${errText}`)
    }
    const createdJson = await res201.json()
    testUsers.provisioned.id = createdJson.id
    if (createdJson.role !== 'user' || createdJson.email !== testUsers.provisioned.email) {
      throw new Error(`Unexpected provisioned response payload: ${JSON.stringify(createdJson)}`)
    }

    // Invariant check: verify resulting profile role in DB is 'user'
    const { data: provProfile, error: provErr } = await adminClient
      .from('profiles')
      .select('id, role, display_name')
      .eq('id', createdJson.id)
      .single()
    if (provErr || provProfile?.role !== 'user') {
      throw new Error(`Provisioning invariant failed: profile role is not 'user', got ${provProfile?.role}`)
    }

    // Test 409: Conflict (duplicate user email)
    const res409 = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUsers.admin.token}`
      },
      body: JSON.stringify({
        email: testUsers.provisioned.email,
        initialPassword: testUsers.provisioned.password,
        displayName: testUsers.provisioned.displayName
      })
    })
    if (res409.status !== 409) {
      throw new Error(`Expected 409 Conflict for duplicate email, got ${res409.status}`)
    }
    console.log('✓ Edge Function admin-create-user 401, 403, 400, 201, and 409 cases verified.')

    // 5. Test Edge Function admin-users authorization & response contract
    console.log('[5/5] Testing Edge Function admin-users authorization & privacy contract...')
    const adminUsersUrl = `${supabaseUrl}/functions/v1/admin-users`
    await ensureFunctionServing('admin-users', adminUsersUrl)

    // Test 401: Unauthorized (no auth header)
    const resUsers401 = await fetch(adminUsersUrl, { method: 'GET' })
    if (resUsers401.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for unauthenticated admin-users call, got ${resUsers401.status}`)
    }

    // Test 403: Forbidden (non-admin user)
    const resUsers403 = await fetch(adminUsersUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${testUsers.userA.token}` }
    })
    if (resUsers403.status !== 403) {
      throw new Error(`Expected 403 Forbidden for non-admin caller to admin-users, got ${resUsers403.status}`)
    }

    // Test 200: OK (valid admin caller)
    const resUsers200 = await fetch(adminUsersUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${testUsers.admin.token}` }
    })
    if (resUsers200.status !== 200) {
      const errTxt = await resUsers200.text()
      throw new Error(`Expected 200 OK for valid admin call to admin-users, got ${resUsers200.status}: ${errTxt}`)
    }
    const adminUsersJson = await resUsers200.json()
    if (!Array.isArray(adminUsersJson.users) || typeof adminUsersJson.total !== 'number') {
      throw new Error(`admin-users response failed schema contract: ${JSON.stringify(adminUsersJson)}`)
    }

    // Strictly verify privacy boundary: numeric task counts ONLY, zero individual task content
    for (const u of adminUsersJson.users) {
      if (typeof u.taskCount !== 'number' || typeof u.todoCount !== 'number') {
        throw new Error(`admin-users entry missing numerical task count statistics: ${JSON.stringify(u)}`)
      }
      if ('tasks' in u || 'title' in u || 'description' in u || 'reminders' in u) {
        throw new Error(`PRIVACY VIOLATION: admin-users exposed individual task content or descriptions: ${JSON.stringify(u)}`)
      }
    }
    console.log('✓ Edge Function admin-users 401, 403, 200, and privacy contract verified.')

    console.log('--- ALL INTEGRATION & SECURITY TESTS PASSED ---')
  } catch (err: any) {
    console.error('[INTEGRATION TEST FAILED]', err?.message || err)
    exitCode = 1
  } finally {
    console.log('Cleaning up integration test fixtures...')
    if (createdTaskId) {
      try {
        await adminClient.from('tasks').delete().eq('id', createdTaskId)
      } catch {
        // ignore task delete error
      }
    }
    await cleanupUser(testUsers.provisioned.id)
    await cleanupUser(testUsers.userA.id)
    await cleanupUser(testUsers.userB.id)
    await cleanupUser(testUsers.admin.id)

    for (const proc of spawnedFunctionProcs) {
      try {
        proc.kill('SIGTERM')
      } catch {
        // ignore proc kill error
      }
    }
  }

  process.exit(exitCode)
}

runIntegration()
