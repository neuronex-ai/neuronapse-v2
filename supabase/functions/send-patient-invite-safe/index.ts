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

    const requestBody = await request.json();
    if (requestBody.channel === 'whatsapp') return json({ success: true, provider: null });
    if (!requestBody.appointmentId) return json({ error: 'Agendamento não informado.' }, 400);

    const appointmentResult = await db.from('appointments')
      .select('id,user_id,patient_id,token,auth_code')
      .eq('id', requestBody.appointmentId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (appointmentResult.error || !appointmentResult.data) {
      return json({ error: 'Agendamento não encontrado para esta conta.' }, 404);
    }

    const appointment = appointmentResult.data;
    const [patientResult, profileResult, templateResult, googleResult] = await Promise.all([
      db.from('patients').select('name,email').eq('id', appointment.patient_id).eq('user_id', user.id).maybeSingle(),
      db.from('profiles').select('first_name,last_name,full_name,clinic_name').eq('id', user.id).maybeSingle(),
      db.from('system_email_templates').select('subject,body_html').eq('template_key', 'patient_invitation').eq('enabled', true).maybeSingle(),
      db.from('user_google_tokens').select('user_id').eq('user_id', user.id).maybeSingle(),
    ]);

    const patient = patientResult.data;
    if (!patient?.email) return json({ error: 'O paciente não possui e-mail cadastrado.' }, 400);

    const profile = profileResult.data;
    const professionalName = profile?.full_name
      || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
      || 'Seu psicólogo';
    const inviteToken = appointment.token || requestBody.token;
    const securityCode = appointment.auth_code || requestBody.authCode || '';
    if (!inviteToken) return json({ error: 'Token do convite não encontrado.' }, 400);

    let legacyError: string | null = null;
    if (googleResult.data) {
      try {
        const legacyResponse = await fetch(`${supabaseUrl}/functions/v1/send-patient-invite`, {
          method: 'POST',
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appointmentId: appointment.id,
            patientEmail: patient.email,
            patientName: patient.name,
            psychologistName: professionalName,
            authCode: securityCode,
            token: inviteToken,
            frontendUrl: 'https://neuronexai.com.br',
            channel: 'email',
          }),
        });
        const legacyPayload = await legacyResponse.json().catch(() => ({}));
        if (legacyResponse.ok && legacyPayload.success === true && legacyPayload.method === 'gmail') {
          await db.from('email_delivery_logs').insert({
            user_id: user.id,
            template_key: 'patient_invitation',
            recipient: patient.email,
            provider: 'gmail',
            sender: user.email,
            status: 'sent',
            provider_message_id: legacyPayload.id || null,
            metadata: { appointmentId: appointment.id, gateway: 'send-patient-invite-safe' },
          });
          return json({ success: true, provider: 'gmail', providerMessageId: legacyPayload.id || null });
        }
        legacyError = legacyPayload.error || legacyPayload.message || `Gmail retornou HTTP ${legacyResponse.status}`;
      } catch (error) {
        legacyError = error instanceof Error ? error.message : 'Falha ao acionar o Gmail.';
      }
    }

    const variables = {
      PATIENT_NAME: patient.name?.split(' ')[0] || 'Paciente',
      PROFESSIONAL_NAME: professionalName,
      SECURITY_CODE: securityCode,
      ACTION_URL: `https://neuronexai.com.br/confirmar-agendamento/${inviteToken}`,
    };
    const subject = render(
      templateResult.data?.subject || `Convite de agendamento — ${profile?.clinic_name || 'NeuroNex'}`,
      variables,
    );
    const html = render(
      templateResult.data?.body_html || '<p>Olá, {{{PATIENT_NAME}}}.</p><p>{{{PROFESSIONAL_NAME}}} enviou um convite seguro.</p><p>Código: <strong>{{{SECURITY_CODE}}}</strong></p><p><a href="{{{ACTION_URL}}}">Acessar portal</a></p>',
      variables,
    );

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `patient-invitation/${appointment.id}`,
      },
      body: JSON.stringify({
        from: 'NeuroNex <notificacoes@email.neuronex.site>',
        to: [patient.email],
        reply_to: user.email,
        subject,
        html,
      }),
    });
    const resendPayload = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      throw new Error(resendPayload.message || `Resend recusou o envio: ${resendResponse.status}`);
    }

    await db.from('email_delivery_logs').insert({
      user_id: user.id,
      template_key: 'patient_invitation',
      recipient: patient.email,
      provider: 'resend',
      sender: 'notificacoes@email.neuronex.site',
      status: 'sent',
      provider_message_id: resendPayload.id || null,
      metadata: {
        appointmentId: appointment.id,
        gateway: 'send-patient-invite-safe',
        gmailError: legacyError,
      },
    });

    return json({ success: true, provider: 'resend', providerMessageId: resendPayload.id || null });
  } catch (error) {
    console.error('[send-patient-invite-safe]', error);
    return json({ error: error instanceof Error ? error.message : 'Não foi possível enviar o convite.' }, 500);
  }
});
