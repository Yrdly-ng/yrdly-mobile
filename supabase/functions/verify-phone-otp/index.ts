import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { pinId, pin } = body;
    
    if (!pinId || !pin) {
      return new Response(JSON.stringify({ error: 'Missing pinId or pin' }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing authorization header' }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const termiiUrl = Deno.env.get('TERMII_BASE_URL') || 'https://v4.api.termii.com'

    const res = await fetch(`${termiiUrl}/api/sms/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: Deno.env.get('TERMII_API_KEY'),
        pin_id: pinId,
        pin,
      }),
    })

    const data = await res.json().catch(() => ({}))

    // verified is a string "True" not a boolean in Termii v4
    if (data.verified !== 'True' && data.verified !== true) {
      let msg = data.message || data.error || 'Invalid or expired code';
      if (typeof msg === 'string' && (msg.toLowerCase().includes('token') || msg.toLowerCase().includes('expired'))) {
        msg = 'The verification code has expired. Please request a new code and try again.';
      }
      return new Response(JSON.stringify({ error: msg }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Mark phone as verified in DB using the user's JWT
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired token' }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Use service role to update the user's profile
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: existingUsers, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('phone', data.msisdn)
      .eq('phone_verified', true)
      .neq('id', user.id)
      .limit(1)

    if (checkError) {
      return new Response(JSON.stringify({ error: checkError.message }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (existingUsers && existingUsers.length > 0) {
      return new Response(JSON.stringify({ error: 'This phone number is already verified on another account.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { error: updateError } = await supabaseAdmin.from('users')
      .update({ phone: data.msisdn, phone_verified: true })
      .eq('id', user.id)

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error(error)
    return new Response(JSON.stringify({ error: `Edge Function Error: ${error.message}` }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
