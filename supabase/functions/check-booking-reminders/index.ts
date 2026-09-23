import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    let remindersSent = 0;

    // 1. Fetch 24-hour reminders
    const { data: bookings24h } = await supabaseAdmin
      .from('bookings')
      .select('*, service:service_offerings(*), business:businesses(*)')
      .eq('status', 'confirmed')
      .eq('reminder_24h_sent', false)
      .lte('appointment_time', in24h.toISOString())
      .gte('appointment_time', now.toISOString());

    if (bookings24h && bookings24h.length > 0) {
      for (const booking of bookings24h) {
        const apptDateStr = new Date(booking.appointment_time).toLocaleString();

        // Notify customer
        if (booking.customer_id) {
          await supabaseAdmin.functions.invoke('send-push-notification', {
            body: {
              userId: booking.customer_id,
              payload: {
                title: 'Upcoming Booking Tomorrow',
                body: `Reminder: You have an appointment for "${booking.service?.name}" with ${booking.business?.name} tomorrow at ${apptDateStr}.`,
                data: { bookingId: booking.id },
              },
              type: 'booking_reminder',
            },
          });
        }

        // Notify provider owner
        if (booking.business?.owner_id) {
          await supabaseAdmin.functions.invoke('send-push-notification', {
            body: {
              userId: booking.business.owner_id,
              payload: {
                title: 'Upcoming Service Appointment',
                body: `Reminder: You have a booking for "${booking.service?.name}" tomorrow at ${apptDateStr}.`,
                data: { bookingId: booking.id },
              },
              type: 'booking_reminder',
            },
          });
        }

        // Mark 24h reminder sent
        await supabaseAdmin
          .from('bookings')
          .update({ reminder_24h_sent: true })
          .eq('id', booking.id);

        remindersSent++;
      }
    }

    // 2. Fetch 2-hour reminders
    const { data: bookings2h } = await supabaseAdmin
      .from('bookings')
      .select('*, service:service_offerings(*), business:businesses(*)')
      .eq('status', 'confirmed')
      .eq('reminder_2h_sent', false)
      .lte('appointment_time', in2h.toISOString())
      .gte('appointment_time', now.toISOString());

    if (bookings2h && bookings2h.length > 0) {
      for (const booking of bookings2h) {
        const apptDateStr = new Date(booking.appointment_time).toLocaleString();

        if (booking.customer_id) {
          await supabaseAdmin.functions.invoke('send-push-notification', {
            body: {
              userId: booking.customer_id,
              payload: {
                title: 'Upcoming Appointment in 2 Hours',
                body: `Your appointment for "${booking.service?.name}" with ${booking.business?.name} starts soon at ${apptDateStr}.`,
                data: { bookingId: booking.id },
              },
              type: 'booking_reminder',
            },
          });
        }

        if (booking.business?.owner_id) {
          await supabaseAdmin.functions.invoke('send-push-notification', {
            body: {
              userId: booking.business.owner_id,
              payload: {
                title: 'Upcoming Appointment in 2 Hours',
                body: `Booking for "${booking.service?.name}" starts in 2 hours (${apptDateStr}).`,
                data: { bookingId: booking.id },
              },
              type: 'booking_reminder',
            },
          });
        }

        await supabaseAdmin
          .from('bookings')
          .update({ reminder_2h_sent: true })
          .eq('id', booking.id);

        remindersSent++;
      }
    }

    return new Response(JSON.stringify({ success: true, remindersSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
