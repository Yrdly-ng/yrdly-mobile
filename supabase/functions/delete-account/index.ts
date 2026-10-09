import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5"

// In-app account deletion (App Store Guideline 5.1.1(v)).
// 1. Refuses while the user has money held in escrow (buyer or seller side).
// 2. Deletes the user's own content (best effort; failures are logged, not fatal).
// 3. Scrubs personal fields on public.users.
// 4. Revokes the Sign in with Apple token when an authorization code is supplied.
// 5. Soft-deletes the auth user: login is disabled and auth PII is obfuscated, without
//    cascading through FKs to financial records that must be retained.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const ACTIVE_ESCROW_STATUSES = ['paid', 'shipped', 'delivered', 'disputed']

// Rows owned by the user that should be removed outright.
const OWNED_CONTENT: Array<[table: string, column: string]> = [
  ['comments', 'user_id'],
  ['comment_likes', 'user_id'],
  ['post_bookmarks', 'user_id'],
  ['event_bookmarks', 'user_id'],
  ['saved_posts', 'user_id'],
  ['notifications', 'user_id'],
  ['posts', 'user_id'],
]

async function revokeAppleToken(authorizationCode: string) {
  const teamId = Deno.env.get('APPLE_TEAM_ID')
  const keyId = Deno.env.get('APPLE_KEY_ID')
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY')
  const clientId = Deno.env.get('APPLE_CLIENT_ID') || 'com.yrdly'
  if (!teamId || !keyId || !privateKey) {
    console.warn('[delete-account] Apple revoke skipped: APPLE_TEAM_ID/APPLE_KEY_ID/APPLE_PRIVATE_KEY not set')
    return
  }

  const key = await importPKCS8(privateKey.replace(/\\n/g, '\n'), 'ES256')
  const clientSecret = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setAudience('https://appleid.apple.com')
    .setSubject(clientId)
    .sign(key)

  const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: 'authorization_code',
    }),
  })
  const tokenData = await tokenRes.json().catch(() => ({}))
  const token = tokenData.refresh_token || tokenData.access_token
  if (!token) {
    console.warn('[delete-account] Apple token exchange failed:', tokenData.error)
    return
  }

  const revokeRes = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token,
      token_type_hint: tokenData.refresh_token ? 'refresh_token' : 'access_token',
    }),
  })
  if (!revokeRes.ok) console.warn('[delete-account] Apple revoke failed:', revokeRes.status)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body = await req.json().catch(() => ({}))

    // 1. Block deletion while escrow funds are held for this user.
    const { count: activeEscrow, error: escrowError } = await admin
      .from('escrow_transactions')
      .select('id', { count: 'exact', head: true })
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .in('status', ACTIVE_ESCROW_STATUSES)
    if (escrowError) throw escrowError
    if ((activeEscrow ?? 0) > 0) {
      return json({
        error:
          'You have orders with money still held in escrow. Please complete or resolve them before deleting your account, or contact support.',
        code: 'ACTIVE_ESCROW',
      }, 409)
    }

    // 2. Delete owned content (best effort — e.g. a sold listing referenced by a transaction may be kept).
    for (const [table, column] of OWNED_CONTENT) {
      const { error } = await admin.from(table).delete().eq(column, user.id)
      if (error) console.warn(`[delete-account] ${table} cleanup failed:`, error.message)
    }

    // 3. Scrub profile PII. The row is kept so retained financial/dispute records still resolve.
    const { error: scrubError } = await admin
      .from('users')
      .update({
        name: 'Deleted user',
        email: null,
        username: null,
        avatar_url: null,
        bio: null,
        location: null,
        current_location: null,
        interests: [],
        share_location: false,
        delete_requested: true,
        delete_requested_at: new Date().toISOString(),
      })
      .eq('id', user.id)
    if (scrubError) throw scrubError

    // 4. Sign in with Apple token revocation (required for SIWA accounts).
    if (typeof body.appleAuthorizationCode === 'string' && body.appleAuthorizationCode) {
      await revokeAppleToken(body.appleAuthorizationCode).catch((e) =>
        console.warn('[delete-account] Apple revoke error:', e?.message)
      )
    }

    // 5. Soft-delete the auth user (disables login, obfuscates auth email/phone).
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, true)
    if (deleteError) throw deleteError

    return json({ success: true })
  } catch (e) {
    console.error('[delete-account] failed:', e)
    return json({ error: 'Could not delete your account. Please try again or contact support.' }, 500)
  }
})
