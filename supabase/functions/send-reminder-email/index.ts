import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: Encode string to Base64 (handles Unicode properly)
function encodeBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: URL-safe Base64 for Gmail API
function toUrlSafeBase64(str: string): string {
  return encodeBase64(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Helper: Refresh Google Access Token
async function refreshAccessToken(
  supabase: any,
  userId: string,
  refreshToken: string
): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Token refresh failed:", errText);
    throw new Error("Failed to refresh Google token");
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Update token in database
  await supabase
    .from("user_google_tokens")
    .update({
      access_token: data.access_token,
      expires_at: expiresAt.toISOString(),
    })
    .eq("user_id", userId);

  return data.access_token;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[send-reminder-email] Function started");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("Auth error:", authError);
      throw new Error("Authentication failed");
    }
    const userId = user.id;
    console.log("[send-reminder-email] User authenticated:", userId);

    // Parse request body
    const body = await req.json();
    const {
      appointmentId,
      patientEmail,
      patientName,
      startTime,
      location,
      type,
      origin,
      action = "reminder",
      cancellationReason,
    } = body;

    console.log(`[send-reminder-email] Action: ${action}, Appointment: ${appointmentId}`);

    // Validate required fields
    if (!patientEmail || !patientName || !startTime) {
      throw new Error("Missing required fields: patientEmail, patientName, startTime");
    }

    // Get therapist profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_name, first_name, last_name")
      .eq("id", userId)
      .single();

    const clinicName = profile?.clinic_name || "Consultorio";
    const therapistName = profile?.first_name
      ? `${profile.first_name} ${profile.last_name || ""}`.trim()
      : "Seu Terapeuta";

    // Format date/time
    const dateObj = new Date(startTime);
    const dateFormatted = dateObj.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timeFormatted = dateObj.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Get Google tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from("user_google_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .single();

    if (tokenError || !tokenData) {
      console.error("Token fetch error:", tokenError);
      throw new Error("Gmail not connected. Please connect your Google account in Settings.");
    }

    let accessToken = tokenData.access_token;

    // Refresh token if expired or about to expire
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date(Date.now() + 5 * 60 * 1000)) {
      console.log("[send-reminder-email] Refreshing expired token...");
      accessToken = await refreshAccessToken(supabase, userId, tokenData.refresh_token);
    }

    // Get Gmail address from Google
    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let googleUser: any;
    if (!userInfoRes.ok) {
      // Try refresh once more
      console.log("[send-reminder-email] UserInfo failed, forcing refresh...");
      accessToken = await refreshAccessToken(supabase, userId, tokenData.refresh_token);
      const retryRes = await fetch(
        "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!retryRes.ok) {
        throw new Error("Could not get Google user info");
      }
      googleUser = await retryRes.json();
    } else {
      googleUser = await userInfoRes.json();
    }

    const senderEmail = googleUser.email;
    console.log("[send-reminder-email] Sending from:", senderEmail);

    // Build email content
    const firstName = patientName.split(" ")[0];
    let subject: string;
    let heading: string;
    let message: string;

    if (action === "cancel") {
      subject = `Consulta Cancelada - ${clinicName}`;
      heading = "Consulta Cancelada";
      message = `Sua consulta de ${dateFormatted} as ${timeFormatted} foi cancelada.${cancellationReason ? ` Motivo: ${cancellationReason}` : ""}`;
    } else if (action === "reschedule") {
      subject = `Consulta Reagendada - ${clinicName}`;
      heading = "Consulta Reagendada";
      message = `Sua consulta foi reagendada para ${dateFormatted} as ${timeFormatted}.`;
    } else {
      subject = `Lembrete: Consulta ${dateFormatted} - ${clinicName}`;
      heading = `Ola, ${firstName}!`;
      message = `Voce tem uma consulta agendada.`;
    }

    const locationText = type === "online" ? "Teleconsulta Online" : (location || "Consultorio");

    // Simple HTML email template (ASCII-safe, no special chars in template literals)
    const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0b;padding:40px 20px;">
    <tr><td align="center">
      <table width="500" cellpadding="0" cellspacing="0" style="background:#141416;border-radius:16px;border:1px solid #27272a;">
        <tr>
          <td style="padding:32px;text-align:center;">
            <p style="color:#71717a;font-size:11px;margin:0 0 16px;text-transform:uppercase;letter-spacing:2px;">${clinicName}</p>
            <h1 style="color:#ffffff;font-size:24px;margin:0 0 8px;">${heading}</h1>
            <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px;">${message}</p>
            <div style="background:#1c1c1e;border-radius:12px;padding:20px;margin:16px 0;">
              <p style="color:#ffffff;font-size:28px;font-weight:bold;margin:0;">${timeFormatted}</p>
              <p style="color:#7c3aed;font-size:14px;margin:4px 0 0;">${dateFormatted}</p>
              <p style="color:#a1a1aa;font-size:12px;margin:12px 0 0;">${locationText}</p>
            </div>
            <p style="color:#52525b;font-size:10px;margin:24px 0 0;text-transform:uppercase;letter-spacing:1px;">Enviado via NeuroNex</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Build RFC 2822 email message
    const encodedSubject = `=?utf-8?B?${encodeBase64(subject)}?=`;
    const encodedFrom = `=?utf-8?B?${encodeBase64(therapistName)}?= <${senderEmail}>`;

    const rawMessage = [
      `To: ${patientEmail}`,
      `From: ${encodedFrom}`,
      `Subject: ${encodedSubject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      encodeBase64(htmlBody),
    ].join("\r\n");

    // Send via Gmail API
    console.log("[send-reminder-email] Sending email via Gmail API...");
    const gmailRes = await fetch(
      "https://www.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: toUrlSafeBase64(rawMessage) }),
      }
    );

    if (!gmailRes.ok) {
      const errText = await gmailRes.text();
      console.error("[send-reminder-email] Gmail API error:", errText);
      throw new Error(`Gmail API error: ${errText}`);
    }

    const result = await gmailRes.json();
    console.log("[send-reminder-email] Email sent successfully. ID:", result.id);

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[send-reminder-email] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});