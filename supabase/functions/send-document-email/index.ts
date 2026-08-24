import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { deliverPatientEmail, escapeHtml, renderTemplate } from '../_shared/email-delivery.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const db = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    { auth: { persistSession: false } },
  );

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Autenticação necessária.' }, 401);

    const authResult = await db.auth.getUser(authorization.replace('Bearer ', ''));
    const user = authResult.data.user;
    if (authResult.error || !user?.email) return json({ error: 'Sessão inválida ou expirada.' }, 401);

    const {
      to,
      subject,
      htmlBody,
      documentType,
      recipientName,
      actionUrl,
      pdfAttachment,
    } = await request.json();

    if (!to || !String(to).includes('@')) return json({ error: 'E-mail de destino inválido.' }, 400);
    if (!pdfAttachment?.filename || !pdfAttachment?.content) return json({ error: 'O documento em PDF é obrigatório.' }, 400);

    const [profileResult, templateResult] = await Promise.all([
      db.from('profiles').select('first_name,last_name,full_name,clinic_name').eq('id', user.id).maybeSingle(),
      db.from('system_email_templates').select('subject,body_html').eq('template_key', 'document_available').eq('enabled', true).maybeSingle(),
    ]);

    const profile = profileResult.data;
    const professionalName = profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Seu psicólogo';
    const documentName = documentType || pdfAttachment.filename || 'Documento';
    const destinationUrl = actionUrl || 'https://neuronexai.com.br/';
    const variables = {
      RECIPIENT_NAME: recipientName || 'Paciente',
      PROFESSIONAL_NAME: professionalName,
      DOCUMENT_NAME: documentName,
      ACTION_URL: destinationUrl,
    };

    const renderedSubject = renderTemplate(
      templateResult.data?.subject || subject || 'Seu documento está disponível',
      variables,
    );

    const fallbackHtml = `<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:32px"><div style="max-width:600px;margin:auto;background:white;border-radius:20px;padding:32px"><h1>${escapeHtml(documentName)}</h1><p>Olá, ${escapeHtml(recipientName || 'Paciente')}.</p><p>${escapeHtml(professionalName)} enviou um documento em anexo.</p>${htmlBody ? `<div style="margin-top:22px;padding:18px;background:#fafafa;border-radius:12px">${htmlBody}</div>` : ''}<p style="margin-top:28px;font-size:11px;color:#71717a">NEURONEX AI · CNPJ 65.610.762/0001-55 · Pinheiros, São Paulo - SP</p></div></body></html>`;
    const renderedHtml = renderTemplate(templateResult.data?.body_html || fallbackHtml, variables);

    const delivery = await deliverPatientEmail({
      db,
      userId: user.id,
      senderName: professionalName,
      senderEmail: user.email,
      to: String(to).trim(),
      subject: renderedSubject,
      html: renderedHtml,
      attachments: [{
        filename: String(pdfAttachment.filename),
        content: String(pdfAttachment.content),
        contentType: pdfAttachment.contentType || 'application/pdf',
      }],
    });

    await db.from('email_delivery_logs').insert({
      user_id: user.id,
      template_key: 'document_available',
      recipient: String(to).trim(),
      provider: delivery.provider,
      sender: delivery.provider === 'gmail' ? user.email : 'notificacoes@email.neuronex.site',
      status: 'sent',
      provider_message_id: delivery.providerMessageId,
      metadata: {
        documentType: documentName,
        filename: pdfAttachment.filename,
        gmailError: delivery.gmailError,
      },
    });

    return json({ success: true, provider: delivery.provider, providerMessageId: delivery.providerMessageId });
  } catch (error) {
    console.error('[send-document-email]', error);
    return json({ error: error instanceof Error ? error.message : 'Não foi possível enviar o documento.' }, 500);
  }
});
