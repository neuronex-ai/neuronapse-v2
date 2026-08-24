import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const render = (html: string, variables: Record<string, unknown>) => Object.entries(variables)
  .reduce((result, [key, value]) => result
    .replaceAll(`{{{${key}}}}`, escapeHtml(value))
    .replaceAll(`{{${key}}}`, escapeHtml(value)), html);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const resendKey = Deno.env.get('RESEND_API_KEY') || '';
  if (!supabaseUrl || !serviceRoleKey || !resendKey) {
    return json({ error: 'Configuração de e-mail incompleta no servidor.' }, 500);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const authorization = request.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Autenticação necessária.' }, 401);

    const authResult = await db.auth.getUser(authorization.slice('Bearer '.length));
    const user = authResult.data.user;
    if (authResult.error || !user?.email) return json({ error: 'Sessão inválida ou expirada.' }, 401);

    const body = await request.json();
    const recipient = String(body.to || '').trim();
    const attachment = body.pdfAttachment;
    if (!recipient.includes('@')) return json({ error: 'E-mail de destino inválido.' }, 400);
    if (!attachment?.filename || !attachment?.content) return json({ error: 'O documento em PDF é obrigatório.' }, 400);

    const [profileResult, templateResult, googleResult] = await Promise.all([
      db.from('profiles').select('first_name,last_name,full_name,clinic_name').eq('id', user.id).maybeSingle(),
      db.from('system_email_templates').select('subject,body_html').eq('template_key', 'document_available').eq('enabled', true).maybeSingle(),
      db.from('user_google_tokens').select('user_id').eq('user_id', user.id).maybeSingle(),
    ]);

    const profile = profileResult.data;
    const professionalName = profile?.full_name
      || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
      || 'Seu psicólogo';
    const documentName = body.documentType || attachment.filename || 'Documento';

    let legacyError: string | null = null;
    if (googleResult.data) {
      try {
        const legacyResponse = await fetch(`${supabaseUrl}/functions/v1/send-document-email`, {
          method: 'POST',
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        const legacyPayload = await legacyResponse.json().catch(() => ({}));
        if (legacyResponse.ok && legacyPayload.success === true) {
          await db.from('email_delivery_logs').insert({
            user_id: user.id,
            template_key: 'document_available',
            recipient,
            provider: 'gmail',
            sender: user.email,
            status: 'sent',
            provider_message_id: legacyPayload.id || null,
            metadata: {
              documentType: documentName,
              filename: attachment.filename,
              gateway: 'send-document-email-safe',
            },
          });
          return json({ success: true, provider: 'gmail', providerMessageId: legacyPayload.id || null });
        }
        legacyError = legacyPayload.error || legacyPayload.message || `Gmail retornou HTTP ${legacyResponse.status}`;
      } catch (error) {
        legacyError = error instanceof Error ? error.message : 'Falha ao acionar o Gmail.';
      }
    }

    const variables = {
      RECIPIENT_NAME: body.recipientName || 'Paciente',
      PROFESSIONAL_NAME: professionalName,
      DOCUMENT_NAME: documentName,
      ACTION_URL: body.actionUrl || 'https://neuronexai.com.br/',
    };
    const subject = render(
      templateResult.data?.subject || body.subject || 'Seu documento está disponível',
      variables,
    );
    const html = render(
      templateResult.data?.body_html || '<p>Olá, {{{RECIPIENT_NAME}}}.</p><p>{{{PROFESSIONAL_NAME}}} enviou o documento {{{DOCUMENT_NAME}}} em anexo.</p>',
      variables,
    );

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NeuroNex <notificacoes@email.neuronex.site>',
        to: [recipient],
        reply_to: user.email,
        subject,
        html,
        attachments: [{
          filename: String(attachment.filename),
          content: String(attachment.content),
        }],
      }),
    });
    const resendPayload = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      throw new Error(resendPayload.message || `Resend recusou o envio: ${resendResponse.status}`);
    }

    await db.from('email_delivery_logs').insert({
      user_id: user.id,
      template_key: 'document_available',
      recipient,
      provider: 'resend',
      sender: 'notificacoes@email.neuronex.site',
      status: 'sent',
      provider_message_id: resendPayload.id || null,
      metadata: {
        documentType: documentName,
        filename: attachment.filename,
        gateway: 'send-document-email-safe',
        gmailError: legacyError,
      },
    });

    return json({ success: true, provider: 'resend', providerMessageId: resendPayload.id || null });
  } catch (error) {
    console.error('[send-document-email-safe]', error);
    return json({ error: error instanceof Error ? error.message : 'Não foi possível enviar o documento.' }, 500);
  }
});
