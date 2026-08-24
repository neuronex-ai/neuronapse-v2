import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

async function refreshAccessToken(supabaseService: any, userId: string, refreshToken: string) {
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID!,
            client_secret: GOOGLE_CLIENT_SECRET!,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }).toString(),
    });

    if (!tokenResponse.ok) return null;
    const tokens = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await supabaseService
        .from("user_google_tokens")
        .update({ access_token: tokens.access_token, expires_at: expiresAt.toISOString() })
        .eq("user_id", userId);

    return tokens.access_token;
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing auth header");
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
        if (!user) throw new Error("Invalid token");

        const { action, fileId, fileName } = await req.json();

        // Get Google Token
        const { data: tokenData } = await supabase
            .from("user_google_tokens")
            .select("*")
            .eq("user_id", user.id)
            .single();
        if (!tokenData) throw new Error("Google account not connected. Connect in Settings first.");

        let accessToken = tokenData.access_token;
        if (new Date(tokenData.expires_at) < new Date(Date.now() + 60000)) {
            const newToken = await refreshAccessToken(supabase, user.id, tokenData.refresh_token);
            if (!newToken) throw new Error("Could not refresh Google token. Please reconnect.");
            accessToken = newToken;
        }

        // ─── LIST FILES ─────────────────────────────────────────
        if (action === "list") {
            const query = new URLSearchParams({
                pageSize: "50",
                fields: "files(id,name,mimeType,size,modifiedTime,iconLink,webViewLink)",
                orderBy: "modifiedTime desc",
                q: "trashed = false and mimeType != 'application/vnd.google-apps.folder'",
            });

            const res = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error("[google-drive-files] List error:", errText);
                throw new Error("Falha ao listar arquivos do Google Drive.");
            }

            const data = await res.json();
            return new Response(JSON.stringify({ files: data.files || [] }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ─── DOWNLOAD / EXPORT FILE ─────────────────────────────
        if (action === "download" && fileId) {
            // First check if it's a Google Docs/Sheets/Slides (needs export)
            const metaRes = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (!metaRes.ok) throw new Error("Falha ao obter metadados do arquivo.");
            const meta = await metaRes.json();

            let fileBlob: Blob;
            let finalName = fileName || meta.name;

            const googleMimeTypes: Record<string, { exportMime: string; ext: string }> = {
                "application/vnd.google-apps.document": { exportMime: "application/pdf", ext: ".pdf" },
                "application/vnd.google-apps.spreadsheet": { exportMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: ".xlsx" },
                "application/vnd.google-apps.presentation": { exportMime: "application/pdf", ext: ".pdf" },
                "application/vnd.google-apps.drawing": { exportMime: "image/png", ext: ".png" },
            };

            if (googleMimeTypes[meta.mimeType]) {
                // Export Google-native file
                const exportInfo = googleMimeTypes[meta.mimeType];
                const exportRes = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportInfo.exportMime)}`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                if (!exportRes.ok) throw new Error("Falha ao exportar arquivo do Google Drive.");
                fileBlob = await exportRes.blob();

                if (!finalName.endsWith(exportInfo.ext)) {
                    finalName += exportInfo.ext;
                }
            } else {
                // Download regular file
                const dlRes = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                if (!dlRes.ok) throw new Error("Falha ao baixar arquivo do Google Drive.");
                fileBlob = await dlRes.blob();
            }

            return new Response(fileBlob, {
                headers: {
                    ...corsHeaders,
                    "Content-Type": fileBlob.type || "application/octet-stream",
                    "Content-Disposition": `attachment; filename="${encodeURIComponent(finalName)}"`,
                },
            });
        }

        throw new Error(`Unknown action: ${action}`);

    } catch (e: any) {
        console.error("[google-drive-files] Error:", e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
