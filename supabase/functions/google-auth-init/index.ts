import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Scopes for NeuroNex functionality
const GOOGLE_SCOPES = [
  // Identity
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  // Calendar sync.
  "https://www.googleapis.com/auth/calendar.events",
  // Appointment reminders and consultation emails sent from the psychologist's account.
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

function sanitizeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\\\")) {
    return "/dashboard?status=success&service=google";
  }
  return value;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jwt = authHeader.replace("Bearer ", "");

    // Verify the user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestUrl = new URL(req.url);
    const returnTo = sanitizeReturnTo(requestUrl.searchParams.get("returnTo"));

    console.log("[google-auth-init] Generating OAuth URL for user:", user.id);

    // Redirect URI must match Google Cloud Console configuration
    const REDIRECT_URI = `${supabaseUrl}/functions/v1/google-auth-callback`;
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");

    if (!GOOGLE_CLIENT_ID) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_CLIENT_ID not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create state with user ID (base64 encoded JSON)
    const stateData = { userId: user.id, timestamp: Date.now(), returnTo };
    const state = btoa(JSON.stringify(stateData));

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", GOOGLE_SCOPES);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent"); // Force consent to get refresh_token
    authUrl.searchParams.set("state", state);

    console.log("[google-auth-init] OAuth URL generated, redirect_uri:", REDIRECT_URI);

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (e: any) {
    console.error("[google-auth-init] Error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
