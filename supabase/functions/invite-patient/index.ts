import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { deliverPatientEmail, renderTemplate } from '../_shared/email-delivery.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
});

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  const db = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', { auth: { persistSession: false } });

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Sessão ausente.' }, 401);
    const userResult = await db.auth.getUser(authorization.replace('Bearer ', ''));
    const user = userResult.data.user;
    if (userResult.error || !user?.email) return json({ error: 'Sessão expirada ou inválida.' }, 401);

    const { patientId, options = {} } = await request.json();
    if (!patientId) return json({ error: 'Paciente não informado.' }, 400);

    const [patientResult, profileResult, templateResult] = await Promise.all([
      db.from('patients').select('id,name,email,phone').eq('id', patientId).eq('user_id', user.id).single(),
      db.from('profiles').select('first_name,last_name,full_name,clinic_name').eq('id', user.id).single(),
      db.from('system_email_templates').select('subject,body_html').eq('template_key', 'patient_invitation').eq('enabled', true).maybeSingle(),
    ]);
    if (patientResult.error || !patientResult.data) return json({ error: 'Paciente não encontrado.' }, 404);
    const patient = patientResult.data;
    const profile = profileResult.data;

    const inviteToken = crypto.randomUUID();
    const authCode = crypto.getRandomValues(new Uint32Array(1))[0].toString().slice(-6).padStart(6, '0');
    const appointmentResult = await db.from('appointments').insert({
      user_id: user.id,
      patient_id: patient.id,
      status: 'pending',
      type: 'Sessão de Terapia',
      token: inviteToken,
      auth_code: authCode,
      price: options.price ? Number(options.price) : null,
      payment_config: { type: options.paymentType || 'manual', price: options.price || null },
    }).select('id').single();
    if (appointmentResult.error) throw appointmentResult.error;

    if (options.channel !== 'email') return json({ success: true, token: inviteToken, authCode, appointmentId: appointmentResult.data.id, provider: null });
    if (!patient.email) return json({ error: 'O paciente não possui e-mail cadastrado.' }, 400);

    const professionalName = profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Seu psicólogo';
    const actionUrl = `https://neuronexai.com.br/confirmar-agendamento/${inviteToken}`;
    const variables = { PATIENT_NAME: patient.name?.split(' ')[0] || 'Olá', PROFESSIONAL_NAME: professionalName, SECURITY_CODE: authCode, ACTION_URL: actionUrl };
    const subject = renderTemplate(templateResult.data?.subject || 'Convite para sua próxima sessão', variables);
    const html = renderTemplate(templateResult.data?.body_html || '<p>Olá, {{{PATIENT_NAME}}}.</p><p>{{{PROFESSIONAL_NAME}}} enviou um convite seguro.</p><p>Código: <strong>{{{SECURITY_CODE}}}</strong></p><p><a href="{{{ACTION_URL}}}">Escolher horário</a></p>', variables);

    const delivery = await deliverPatientEmail({ db, userId: user.id, senderName: professionalName, senderEmail: user.email, to: patient.email, subject, html });

    await db.from('email_delivery_logs').insert({
      user_id: user.id,
      template_key: 'patient_invitation',
      recipient: patient.email,
      provider: delivery.provider,
      sender: delivery.provider === 'gmail' ? user.email : 'notificacoes@email.neuronex.site',
      status: 'sent',
      provider_message_id: delivery.providerMessageId,
      metadata: { appointmentId: appointmentResult.data.id, gmailError: delivery.gmailError },
    });

    return json({ success: true, token: inviteToken, authCode, appointmentId: appointmentResult.data.id, provider: delivery.provider });
  } catch (error) {
    console.error('[invite-patient]', error);
    return json({ error: error instanceof Error ? error.message : 'Não foi possível enviar o convite.' }, 500);
  }
});
