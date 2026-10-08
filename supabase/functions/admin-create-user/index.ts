import { corsHeaders, verifyAdminCaller } from '../_shared/admin-auth.ts'

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

  const authResult = await verifyAdminCaller(req)
  if (!authResult.ok) {
    return authResult.response
  }

  const { serviceClient } = authResult

  // 1. Parse and validate body
  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new Response(
      JSON.stringify({ error: 'Request body must be a JSON object' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { email, displayName, initialPassword, ...rest } = body

  // Disallow unexpected or unpermitted fields (e.g. role)
  if (Object.keys(rest).length > 0 || rest.role !== undefined) {
    return new Response(
      JSON.stringify({ error: 'Invalid input: unpermitted fields provided' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const trimmedEmail = typeof email === 'string' ? email.trim() : ''
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return new Response(
      JSON.stringify({ error: 'Valid email is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (displayName !== undefined && displayName !== null && typeof displayName !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Display name must be a string' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const cleanDisplayName = typeof displayName === 'string' ? displayName.trim() : null

  // Resolve password: from body or from deployment secret
  let resolvedPassword = ''
  if (typeof initialPassword === 'string' && initialPassword.length > 0) {
    if (initialPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Initial password must be at least 8 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    resolvedPassword = initialPassword
  } else {
    const defaultPassword = Deno.env.get('TABDO_DEFAULT_USER_PASSWORD')
    if (!defaultPassword || defaultPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    resolvedPassword = defaultPassword
  }

  // 2. Create user with server-only service-role client
  const { data: createdData, error: createError } = await serviceClient.auth.admin.createUser({
    email: trimmedEmail,
    password: resolvedPassword,
    email_confirm: true,
    user_metadata: {
      ...(cleanDisplayName ? { displayName: cleanDisplayName } : {}),
      mustChangePassword: true,
    },
  })

  if (createError) {
    const errorMsg = createError.message.toLowerCase()
    if (
      errorMsg.includes('already registered') ||
      errorMsg.includes('already exists') ||
      createError.status === 422
    ) {
      return new Response(
        JSON.stringify({ error: 'A user with this email address already exists.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    return new Response(
      JSON.stringify({ error: 'Failed to create user' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!createdData?.user) {
    return new Response(
      JSON.stringify({ error: 'Failed to provision user' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const userId = createdData.user.id

  // 3. Ensure created profile is active, forced to change password, and role is strictly 'user'
  const { error: updateError } = await serviceClient
    .from('profiles')
    .update({
      role: 'user',
      is_active: true,
      must_change_password: true,
    })
    .eq('id', userId)

  if (updateError) {
    // Compensate: Delete user account to prevent orphaned profile/auth mismatches
    await serviceClient.auth.admin.deleteUser(userId).catch(() => {})
    return new Response(
      JSON.stringify({ error: 'Failed to configure user profile' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { data: verifiedProfile, error: verifyError } = await serviceClient
    .from('profiles')
    .select('id, role, display_name, is_active, must_change_password')
    .eq('id', userId)
    .maybeSingle()

  if (
    verifyError ||
    !verifiedProfile ||
    verifiedProfile.role !== 'user' ||
    verifiedProfile.must_change_password !== true
  ) {
    // Compensate
    await serviceClient.auth.admin.deleteUser(userId).catch(() => {})
    return new Response(
      JSON.stringify({ error: 'Failed to verify created user profile guarantee' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      id: createdData.user.id,
      email: createdData.user.email,
      displayName: verifiedProfile.display_name ?? cleanDisplayName,
      role: 'user',
      isActive: true,
      mustChangePassword: true,
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
