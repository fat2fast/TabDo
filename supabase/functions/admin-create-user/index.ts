import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Missing or invalid Authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // 1. Authenticate caller with caller-scoped client
  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const { data: { user: callerUser }, error: userError } = await callerClient.auth.getUser()
  if (userError || !callerUser) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // 2. Authorize caller - must be admin
  const { data: callerProfile, error: profileError } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', callerUser.id)
    .maybeSingle()

  if (profileError || !callerProfile || callerProfile.role !== 'admin') {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Admin access required' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // 3. Parse and validate body
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

  if (typeof initialPassword !== 'string' || initialPassword.length < 8) {
    return new Response(
      JSON.stringify({ error: 'Initial password must be at least 8 characters' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // 4. Create user with server-only service-role client
  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const { data: createdData, error: createError } = await serviceClient.auth.admin.createUser({
    email: trimmedEmail,
    password: initialPassword,
    email_confirm: true,
    user_metadata: cleanDisplayName ? { displayName: cleanDisplayName } : {}
  })

  if (createError) {
    const errorMsg = createError.message.toLowerCase()
    if (errorMsg.includes('already registered') || errorMsg.includes('already exists') || createError.status === 422) {
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

  // 5. Ensure created profile role is explicitly 'user'
  const { error: updateError } = await serviceClient
    .from('profiles')
    .update({ role: 'user' })
    .eq('id', createdData.user.id)

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Failed to configure user profile' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { data: verifiedProfile, error: verifyError } = await serviceClient
    .from('profiles')
    .select('id, role, display_name')
    .eq('id', createdData.user.id)
    .maybeSingle()

  if (verifyError || !verifiedProfile || verifiedProfile.role !== 'user') {
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
      role: 'user'
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
