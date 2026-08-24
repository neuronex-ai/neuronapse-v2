import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Production domain
const PRODUCTION_DOMAIN = "https://neuronex.site";

function sanitizeReturnTo(value: unknown) {
    const raw = String(value || "").trim();
    if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\\\")) {
        return "/dashboard?status=success&service=google";
    }
    return raw;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    // Determine base URL for redirects
    let baseUrl = Deno.env.get("FRONTEND_URL") || PRODUCTION_DOMAIN;
    baseUrl = baseUrl.replace(/\/$/, "");

    // Force HTTPS for non-localhost
    if (!baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1")) {
        if (!baseUrl.startsWith("https://")) {
            baseUrl = `https://${baseUrl.replace(/^http:\/\//, "")}`;
        }
    }

    const REDIRECT_FAILURE_URL = `${baseUrl}/ajustes?status=error&service=google`;

    try {
        console.log("[google-auth-callback] Callback received");

        const url = new URL(req.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state"); // Contains userId
        const errorParam = url.searchParams.get("error");

        if (errorParam) {
            console.error("[google-auth-callback] OAuth error:", errorParam);
            return Response.redirect(`${REDIRECT_FAILURE_URL}&message=${encodeURIComponent(errorParam)}`, 302);
        }

        if (!code || !state) {
            console.error("[google-auth-callback] Missing code or state");
            return Response.redirect(`${REDIRECT_FAILURE_URL}&message=Missing%20code%20or%20state`, 302);
        }

        // Parse state to get userId
        let userId: string;
        let returnTo = "/dashboard?status=success&service=google";
        try {
            const stateData = JSON.parse(atob(state));
            userId = stateData.userId;
            returnTo = sanitizeReturnTo(stateData.returnTo);
            if (!userId) throw new Error("No userId in state");
        } catch (e) {
            console.error("[google-auth-callback] Invalid state:", e);
            return Response.redirect(`${REDIRECT_FAILURE_URL}&message=Invalid%20state`, 302);
        }

        console.log("[google-auth-callback] Processing for user:", userId);

        // Initialize Supabase with service role
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Google OAuth credentials
        const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
        const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            console.error("[google-auth-callback] Missing Google credentials");
            return Response.redirect(`${REDIRECT_FAILURE_URL}&message=Server%20configuration%20error`, 302);
        }

        // Build redirect URI (must match what was used in google-auth-init)
        const redirectUri = `${supabaseUrl}/functions/v1/google-auth-callback`;

        // Exchange code for tokens
        console.log("[google-auth-callback] Exchanging code for tokens...");
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error("[google-auth-callback] Token exchange failed:", errorText);
            return Response.redirect(`${REDIRECT_FAILURE_URL}&message=Token%20exchange%20failed`, 302);
        }

        const tokens = await tokenResponse.json();
        console.log("[google-auth-callback] Tokens received successfully");

        // Calculate expiration
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

        // Upsert tokens to database
        const { error: dbError } = await supabase
            .from("user_google_tokens")
            .upsert(
                {
                    user_id: userId,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    expires_at: expiresAt.toISOString(),
                    scope: tokens.scope,
                    token_type: tokens.token_type,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id" }
            );

        if (dbError) {
            console.error("[google-auth-callback] Database error:", dbError);
            return Response.redirect(`${REDIRECT_FAILURE_URL}&message=Database%20error`, 302);
        }

        const successTarget = returnTo.includes("status=success")
            ? returnTo
            : `${returnTo}${returnTo.includes("?") ? "&" : "?"}status=success&service=google`;

        console.log("[google-auth-callback] Tokens saved! Redirecting to:", successTarget);
        return Response.redirect(`${baseUrl}${successTarget}`, 302);

    } catch (error: any) {
        console.error("[google-auth-callback] Unhandled error:", error);
        return Response.redirect(`${REDIRECT_FAILURE_URL}&message=${encodeURIComponent(error.message)}`, 302);
    }
});
