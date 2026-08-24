import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-neuronex-webhook-secret',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const base64Url = (input: Uint8Array | string) => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const pemToArrayBuffer = (pem: string) => {
  const normalized = pem.replace(/\\n/g, '\n');
  const base64 = normalized
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
};

async function getFirebaseAccessToken() {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase service account secrets are incomplete.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(`Firebase OAuth failed: ${payload.error_description || payload.error || response.status}`);
  }
  return { accessToken: String(payload.access_token), projectId };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Supabase environment is incomplete' }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const providedSecret = req.headers.get('x-neuronex-webhook-secret') || '';
    const verification = await supabase.rpc('verify_notification_webhook_secret', {
      p_channel: 'push',
      p_candidate: providedSecret,
    });
    if (verification.error || verification.data !== true) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const notificationId = body.notificationId || body.record?.id;
    if (!notificationId) return json({ error: 'Notification id is required' }, 400);

    const notificationResult = await supabase
      .from('notifications')
      .select('id,user_id,title,message,action_url,data,payload,push_status,push_attempts')
      .eq('id', notificationId)
      .maybeSingle();
    if (notificationResult.error) throw notificationResult.error;
    const notification = notificationResult.data;
    if (!notification) return json({ error: 'Notification not found' }, 404);
    if (!['pending', 'failed'].includes(notification.push_status)) {
      return json({ success: true, skipped: true, status: notification.push_status });
    }

    await supabase.from('notifications').update({
      push_status: 'processing',
      push_attempts: Number(notification.push_attempts || 0) + 1,
      push_last_error: null,
    }).eq('id', notification.id);

    const subscriptionsResult = await supabase
      .from('push_subscriptions')
      .select('id,fcm_token')
      .eq('user_id', notification.user_id)
      .eq('enabled', true);
    if (subscriptionsResult.error) throw subscriptionsResult.error;
    const subscriptions = subscriptionsResult.data || [];
    if (subscriptions.length === 0) {
      await supabase.from('notifications').update({ push_status: 'no_devices' }).eq('id', notification.id);
      return json({ success: true, status: 'no_devices' });
    }

    const { accessToken, projectId } = await getFirebaseAccessToken();
    const metadata = notification.data || notification.payload || {};
    const link = notification.action_url || 'https://neuronexai.com.br/dashboard';
    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
      const attemptedAt = new Date().toISOString();
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: subscription.fcm_token,
            notification: { title: notification.title, body: notification.message },
            data: {
              notificationId: notification.id,
              actionUrl: link,
              type: String(metadata.type || ''),
            },
            webpush: {
              headers: { Urgency: 'high' },
              notification: {
                icon: 'https://neuronexai.com.br/pwa-192.png',
                badge: 'https://neuronexai.com.br/pwa-192.png',
                tag: notification.id,
                renotify: false,
              },
              fcm_options: { link },
            },
          },
        }),
      });

      const responsePayload = await response.json().catch(() => ({}));
      if (response.ok) {
        sent += 1;
        await supabase.from('notification_push_deliveries').upsert({
          notification_id: notification.id,
          user_id: notification.user_id,
          subscription_id: subscription.id,
          status: 'sent',
          provider_message_id: responsePayload.name || null,
          attempted_at: attemptedAt,
          sent_at: new Date().toISOString(),
          error_code: null,
          error_message: null,
        }, { onConflict: 'notification_id,subscription_id' });
      } else {
        failed += 1;
        const errorStatus = responsePayload?.error?.status || String(response.status);
        const errorMessage = responsePayload?.error?.message || 'FCM rejected the message';
        const invalidToken = response.status === 404 || errorStatus === 'UNREGISTERED';
        if (invalidToken) {
          await supabase.from('push_subscriptions').update({ enabled: false }).eq('id', subscription.id);
        }
        await supabase.from('notification_push_deliveries').upsert({
          notification_id: notification.id,
          user_id: notification.user_id,
          subscription_id: subscription.id,
          status: invalidToken ? 'invalid_token' : 'failed',
          attempted_at: attemptedAt,
          error_code: errorStatus,
          error_message: errorMessage,
        }, { onConflict: 'notification_id,subscription_id' });
      }
    }

    const finalStatus = sent === subscriptions.length ? 'sent' : sent > 0 ? 'partial' : 'failed';
    await supabase.from('notifications').update({
      push_status: finalStatus,
      push_sent_at: sent > 0 ? new Date().toISOString() : null,
      push_last_error: failed > 0 ? `${failed} entrega(s) falharam` : null,
    }).eq('id', notification.id);

    return json({ success: true, status: finalStatus, sent, failed });
  } catch (error) {
    console.error('[dispatch-push-notification]', error);
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
