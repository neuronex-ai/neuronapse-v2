import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { deliverPatientEmail, renderTemplate } from '../_shared/email-delivery.ts';

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
      appointmentId,
      patientEmail,
      patientName,
      psychologistName,
      authCode,
      token,
      channel = 'email',
    } = await request.json();

    if (channel === 'whatsapp') return json({ success: true, provider: null, message: 'WhatsApp handled by frontend' });
    if (!patientEmail || !String(patientEmail).includes('@')) return json({ error: 'E-mail do paciente inválido.' }, 400);
    if (!appointmentId) return json({ error: 'Agendamento não informado.' }, 400);

    const appointmentResult = await db.from('appointments')
      .select('id,user_id,patient_id,token,auth_code')
      .eq('id', appointmentId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (appointmentResult.error || !appointmentResult.data) return json({ error: 'Agendamento não encontrado para esta conta.' }, 404);

    const [profileResult, templateResult] = await Promise.all([
      db.from('profiles').select('first_name,last_name,full_name,clinic_name').eq('id', user.id).maybeSingle(),
      db.from('system_email_templates').select('subject,body_html').eq('template_key', 'patient_invitation').eq('enabled', true).maybeSingle(),
    ]);

    const profile = profileResult.data;
    const professionalName = psychologistName && psychologistName !== 'Seu Psicólogo'
      ? psychologistName
      : profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Seu psicólogo';
    const securityCode = authCode || appointmentResult.data.auth_code || '';
    const inviteToken = token || appointmentResult.data.token;
    if (!inviteToken) return json({ error: 'Token do convite não encontrado.' }, 400);

    const actionUrl = `https://neuronexai.com.br/confirmar-agendamento/${inviteToken}`;
    const variables = {
      PATIENT_NAME: String(patientName || 'Paciente').split(' ')[0],
      PROFESSIONAL_NAME: professionalName,
      SECURITY_CODE: securityCode,
      ACTION_URL: actionUrl,
    };

    const subject = renderTemplate(
      templateResult.data?.subject || `Convite de agendamento — ${profile?.clinic_name || 'NeuroNex'}`,
      variables,
    );
    const html = renderTemplate(
      templateResult.data?.body_html || '<p>Olá, {{{PATIENT_NAME}}}.</p><p>{{{PROFESSIONAL_NAME}}} enviou um convite seguro.</p><p>Código: <strong>{{{SECURITY_CODE}}}</strong></p><p><a href="{{{ACTION_URL}}}">Acessar portal</a></p>',
      variables,
    );

    const delivery = await deliverPatientEmail({
      db,
      userId: user.id,
      senderName: professionalName,
      senderEmail: user.email,
      to: String(patientEmail).trim(),
      subject,
      html,
    });

    await db.from('email_delivery_logs').insert({
      user_id: user.id,
      template_key: 'patient_invitation',
      recipient: String(patientEmail).trim(),
      provider: delivery.provider,
      sender: delivery.provider === 'gmail' ? user.email : 'notificacoes@email.neuronex.site',
      status: 'sent',
      provider_message_id: delivery.providerMessageId,
      metadata: {
        appointmentId,
        gmailError: delivery.gmailError,
      },
    });

    return json({ success: true, provider: delivery.provider, providerMessageId: delivery.providerMessageId });
  } catch (error) {
    console.error('[send-patient-invite]', error);
    return json({ error: error instanceof Error ? error.message : 'Não foi possível enviar o convite.' }, 500);
  }
});
