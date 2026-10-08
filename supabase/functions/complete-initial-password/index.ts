import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/admin-auth.ts'

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
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user: callerUser },
    error: userError,
  } = await callerClient.auth.getUser()

  if (userError || !callerUser) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // 2. Fetch server-side profile to check active and forced state
  const { data: profile, error: profileErr } = await callerClient
    .from('profiles')
    .select('id, is_active, must_change_password')
    .eq('id', callerUser.id)
    .maybeSingle()

  if (profileErr || !profile) {
    return new Response(
      JSON.stringify({ error: 'Profile not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (profile.is_active !== true) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Account is inactive' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (profile.must_change_password !== true) {
    return new Response(
      JSON.stringify({ error: 'Conflict: Initial password change is not required for this account' }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

  const { newPassword, ...rest } = body

  // Disallow user-id, role, or other unpermitted fields
  if (Object.keys(rest).length > 0) {
    return new Response(
      JSON.stringify({ error: 'Invalid input: unpermitted fields provided' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return new Response(
      JSON.stringify({ error: 'New password must be at least 8 characters' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // 4. Update password in Auth using service-role client
  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: updateAuthErr } = await serviceClient.auth.admin.updateUserById(callerUser.id, {
    password: newPassword,
  })

  if (updateAuthErr) {
    return new Response(
      JSON.stringify({ error: 'Failed to update authentication credentials' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // 5. Clear must_change_password flag on profile conditionally
  const { error: clearFlagErr } = await serviceClient
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', callerUser.id)
    .eq('is_active', true)

  if (clearFlagErr) {
    return new Response(
      JSON.stringify({
        error: 'Password updated, but failed to clear change requirement flag. Please retry.',
        retrySafe: true,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      ok: true,
      message: 'Password changed successfully',
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
