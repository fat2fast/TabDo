import { corsHeaders, verifyAdminCaller } from '../_shared/admin-auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authResult = await verifyAdminCaller(req)
  if (!authResult.ok) {
    return authResult.response
  }

  const { callerUser, serviceClient } = authResult

  const url = new URL(req.url)

  let body: any = null
  if (req.method === 'POST') {
    try {
      body = await req.json()
    } catch {
      // not JSON or empty body
    }
  }

  // Handle Lifecycle actions if POST with body.action
  if (req.method === 'POST' && body?.action) {
    const { action, userId, ...rest } = body || {}
    if (Object.keys(rest).length > 0) {
      return new Response(
        JSON.stringify({ error: 'Unpermitted fields provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!action || !['activate', 'deactivate'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Action must be activate or deactivate' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!userId || typeof userId !== 'string' || userId.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Valid userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cannot self-deactivate
    if (userId === callerUser.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot deactivate or modify own admin account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify target profile
    const { data: targetProfile, error: targetErr } = await serviceClient
      .from('profiles')
      .select('id, role, is_active')
      .eq('id', userId)
      .maybeSingle()

    if (targetErr || !targetProfile) {
      return new Response(
        JSON.stringify({ error: 'Target user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Forbid modifying admin role targets
    if (targetProfile.role === 'admin') {
      return new Response(
        JSON.stringify({ error: 'Cannot modify lifecycle of admin accounts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'deactivate') {
      // 1. Fail-closed: update profile is_active = false first
      const { error: profUpdateErr } = await serviceClient
        .from('profiles')
        .update({ is_active: false })
        .eq('id', userId)

      if (profUpdateErr) {
        return new Response(
          JSON.stringify({ error: 'Failed to deactivate user profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // 2. Ban in Auth
      const { error: banErr } = await serviceClient.auth.admin.updateUserById(userId, {
        ban_duration: '876600h',
      })

      if (banErr) {
        return new Response(
          JSON.stringify({
            error: 'Profile marked inactive, but Auth ban could not be completed. Please retry.',
            reconciliationNeeded: true,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          ok: true,
          userId,
          isActive: false,
          action: 'deactivate',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // action === 'activate'
      // 1. Unban in Auth first
      const { error: unbanErr } = await serviceClient.auth.admin.updateUserById(userId, {
        ban_duration: 'none',
      })

      if (unbanErr) {
        return new Response(
          JSON.stringify({ error: 'Failed to unban user in Auth' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // 2. Set profile is_active = true
      const { error: profUpdateErr } = await serviceClient
        .from('profiles')
        .update({ is_active: true })
        .eq('id', userId)

      if (profUpdateErr) {
        return new Response(
          JSON.stringify({
            error: 'Auth unbanned, but failed to update profile active state. Please retry.',
            reconciliationNeeded: true,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          ok: true,
          userId,
          isActive: true,
          action: 'activate',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  // Handle Query (List users or Stats) via GET or POST
  const isStats = url.searchParams.get('stats') === 'true' || body?.stats === true

    if (isStats) {
      // 1. Return dashboard aggregate stats
      const { data: profiles, error: pErr } = await serviceClient
        .from('profiles')
        .select('id, is_active')

      if (pErr) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch profiles for stats' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const totalUsers = profiles.length
      const activeUsers = profiles.filter((p: any) => p.is_active).length
      const inactiveUsers = totalUsers - activeUsers

      const { data: counts, error: cErr } = await serviceClient.rpc('get_user_task_counts')
      if (cErr) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch task counts for stats' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      let totalTasks = 0
      let todoTasks = 0
      let inProgressTasks = 0
      let doneTasks = 0

      for (const row of counts || []) {
        totalTasks += Number(row.task_count || 0)
        todoTasks += Number(row.todo_count || 0)
        inProgressTasks += Number(row.in_progress_count || 0)
        doneTasks += Number(row.done_count || 0)
      }

      return new Response(
        JSON.stringify({
          totalUsers,
          activeUsers,
          inactiveUsers,
          totalTasks,
          todoTasks,
          inProgressTasks,
          doneTasks,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Return paginated list of users with task counts
    const page = Math.max(1, parseInt(body?.page || url.searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(body?.pageSize || url.searchParams.get('pageSize') || '20', 10) || 20))
    const search = (body?.search || url.searchParams.get('search') || '').trim().toLowerCase()
    const roleFilter = body?.role || url.searchParams.get('role') || 'all'
    const statusFilter = body?.status || url.searchParams.get('status') || 'all'
    const sortBy = body?.sortBy || url.searchParams.get('sortBy') || 'createdAt'
    const sortOrder = body?.sortOrder || url.searchParams.get('sortOrder') || 'desc'

    // Fetch Auth users for email and banned_until mapping
    const { data: authUsersData, error: authUsersErr } = await serviceClient.auth.admin.listUsers({
      perPage: 1000,
    })

    if (authUsersErr) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch auth users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authMap = new Map<string, { email: string; bannedUntil: string | null }>()
    for (const u of authUsersData.users || []) {
      authMap.set(u.id, {
        email: u.email || '',
        bannedUntil: (u as any).banned_until || null,
      })
    }

    // Fetch all profiles
    let profileQuery = serviceClient.from('profiles').select('*')
    if (roleFilter !== 'all') {
      profileQuery = profileQuery.eq('role', roleFilter)
    }
    if (statusFilter === 'active') {
      profileQuery = profileQuery.eq('is_active', true)
    } else if (statusFilter === 'inactive') {
      profileQuery = profileQuery.eq('is_active', false)
    }

    const { data: allProfiles, error: profErr } = await profileQuery
    if (profErr) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profiles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Merge profiles with Auth user info
    let combined = (allProfiles || []).map((p: any) => {
      const authInfo = authMap.get(p.id) || { email: '', bannedUntil: null }
      return {
        id: p.id,
        email: authInfo.email,
        displayName: p.display_name,
        role: p.role,
        isActive: p.is_active,
        mustChangePassword: p.must_change_password,
        locale: p.locale || 'vi',
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        bannedUntil: authInfo.bannedUntil,
        taskCount: 0,
        todoCount: 0,
        inProgressCount: 0,
        doneCount: 0,
      }
    })

    // Apply search filter on email or displayName
    if (search) {
      combined = combined.filter((u: any) => {
        const matchesEmail = u.email.toLowerCase().includes(search)
        const matchesName = (u.displayName || '').toLowerCase().includes(search)
        return matchesEmail || matchesName
      })
    }

    // Fetch task counts for these users
    const userIds = combined.map((u: any) => u.id)
    if (userIds.length > 0) {
      const { data: countsData } = await serviceClient.rpc('get_user_task_counts', {
        target_user_ids: userIds,
      })

      if (countsData) {
        const countMap = new Map<string, any>()
        for (const c of countsData) {
          countMap.set(c.user_id, c)
        }
        for (const u of combined) {
          const c = countMap.get(u.id)
          if (c) {
            u.taskCount = Number(c.task_count || 0)
            u.todoCount = Number(c.todo_count || 0)
            u.inProgressCount = Number(c.in_progress_count || 0)
            u.doneCount = Number(c.done_count || 0)
          }
        }
      }
    }

    // Sort
    combined.sort((a: any, b: any) => {
      let valA: any
      let valB: any
      if (sortBy === 'email') {
        valA = a.email.toLowerCase()
        valB = b.email.toLowerCase()
      } else if (sortBy === 'displayName') {
        valA = (a.displayName || '').toLowerCase()
        valB = (b.displayName || '').toLowerCase()
      } else if (sortBy === 'taskCount') {
        valA = a.taskCount
        valB = b.taskCount
      } else {
        valA = new Date(a.createdAt).getTime()
        valB = new Date(b.createdAt).getTime()
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    // Paginate
    const total = combined.length
    const totalPages = Math.ceil(total / pageSize) || 1
    const startIndex = (page - 1) * pageSize
    const paginatedUsers = combined.slice(startIndex, startIndex + pageSize)

    return new Response(
      JSON.stringify({
        users: paginatedUsers,
        total,
        page,
        pageSize,
        totalPages,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
})
