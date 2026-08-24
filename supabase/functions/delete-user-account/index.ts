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
        const { exportData } = await req.json();

        // Auth User
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Export Data Logic
        if (exportData) {
            const { data: tokens } = await supabaseAdmin
                .from('user_google_tokens')
                .select('access_token')
                .eq('user_id', user.id)
                .single();

            if (tokens) {
                try {
                    // Gather all user data (mock for now, real DB queries would go here)
                    // e.g. const { data: patients } = await supabaseAdmin.from('patients').select('*').eq('user_id', user.id);
                    // Since we don't have all schemas handy, we'll export the profile as a PoC.
                    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();

                    const exportPayload = {
                        profile,
                        exported_at: new Date().toISOString()
                    };

                    // Generate Metadata
                    const metadata = {
                        name: 'NeuroNex_Data_Export.json',
                        mimeType: 'application/json'
                    };

                    // Construct Multipart Body manually (Deno specific)
                    const boundary = '-------314159265358979323846';
                    const delimiter = `\r\n--${boundary}\r\n`;
                    const closeDelimiter = `\r\n--${boundary}--`;

                    const body = delimiter +
                        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                        JSON.stringify(metadata) +
                        delimiter +
                        'Content-Type: application/json\r\n\r\n' +
                        JSON.stringify(exportPayload, null, 2) +
                        closeDelimiter;

                    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${tokens.access_token}`,
                            'Content-Type': `multipart/related; boundary=${boundary}`
                        },
                        body: body
                    });

                    if (!res.ok) {
                        const err = await res.text();
                        console.error("Drive upload failed:", err);
                        // IF EXPORT FAILS, WE STOP.
                        throw new Error('Falha ao exportar para o Google Drive: ' + err);
                    }
                } catch (error: any) {
                    console.error("Export Error:", error);
                    return new Response(JSON.stringify({ error: error.message || 'Error exporting details' }), {
                        status: 500,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }
            } else {
                return new Response(JSON.stringify({ error: 'Google Account not connected.' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        }

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

        if (deleteError) throw deleteError;

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error("Handler error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
