import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Security Check: Verify the secret from Jitsi
    const configuredSecret = Deno.env.get('JITSI_WEBHOOK_SECRET');
    const requestSecret = req.headers.get('Authorization');

    if (!configuredSecret || requestSecret !== configuredSecret) {
      console.warn("Jitsi Webhook: Unauthorized attempt.");
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const payload = await req.json();
    const eventName = payload.name;
    const roomName = payload.room_name;

    console.log(`Jitsi Webhook Received: ${eventName} for room ${roomName}`);

    // The room name is in the format: vpaas-magic-cookie-XYZ/appointmentId
    const appointmentId = roomName?.split('/')[1];
    if (!appointmentId) {
      console.log("Could not parse appointmentId from room name.");
      return new Response(JSON.stringify({ received: true, message: "No appointmentId found." }), { status: 200, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 2. Handle different events
    switch (eventName) {
      case 'ROOM_DESTROYED': {
        // This is a reliable way to know the session has ended.
        // We can mark the appointment as 'completed'.
        const { error } = await supabaseAdmin
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', appointmentId)
          .eq('status', 'confirmed'); // Only update if it was confirmed, not cancelled

        if (error) {
          console.error(`Error updating appointment ${appointmentId} to completed:`, error);
        } else {
          console.log(`Appointment ${appointmentId} marked as completed.`);
        }
        break;
      }

      case 'TRANSCRIPTION_UPLOADED': {
        // Here you could fetch the transcription and save it to the session_notes table
        const transcriptionUrl = payload.url;
        console.log(`Transcription for room ${roomName} is available at: ${transcriptionUrl}`);
        // TODO: Add logic to fetch and save the transcript content
        break;
      }
      
      default:
        console.log(`Unhandled Jitsi event: ${eventName}`);
        break;
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders });

  } catch (e: any) {
    console.error("Error in Jitsi webhook handler:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});