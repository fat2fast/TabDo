import { createClient, type SupabaseClient, type User } from 'jsr:@supabase/supabase-js@2'
import { resolveSupabaseKeys } from './supabase-keys.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

export interface CallerAdminProfile {
  id: string
  role: string
  is_active: boolean
  display_name: string | null
}

export type AdminAuthResult =
  | {
      ok: true
      callerUser: User
      callerProfile: CallerAdminProfile
      serviceClient: SupabaseClient
      callerClient: SupabaseClient
      supabaseUrl: string
      publishableKey: string
      secretKey: string
      supabaseAnonKey: string
      supabaseServiceRoleKey: string
    }
  | {
      ok: false
      response: Response
    }

export async function verifyAdminCaller(req: Request): Promise<AdminAuthResult> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    }
  }

  const resolved = resolveSupabaseKeys()
  if (!resolved.ok) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: resolved.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    }
  }

  const { supabaseUrl, publishableKey, secretKey } = resolved.keys

  // 1. Authenticate caller with caller-scoped publishable client
  const callerClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user: callerUser },
    error: userError,
  } = await callerClient.auth.getUser()

  if (userError || !callerUser) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    }
  }

  // 2. Authorize caller - must be active admin
  const { data: callerProfile, error: profileError } = await callerClient
    .from('profiles')
    .select('id, role, is_active, display_name')
    .eq('id', callerUser.id)
    .maybeSingle()

  if (
    profileError ||
    !callerProfile ||
    callerProfile.role !== 'admin' ||
    callerProfile.is_active !== true
  ) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'Forbidden: Active admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    }
  }

  // 3. Construct service client only after caller verification succeeds
  const serviceClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    ok: true,
    callerUser,
    callerProfile: callerProfile as CallerAdminProfile,
    serviceClient,
    callerClient,
    supabaseUrl,
    publishableKey,
    secretKey,
    supabaseAnonKey: publishableKey,
    supabaseServiceRoleKey: secretKey,
  }
}
