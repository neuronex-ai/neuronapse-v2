import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const templates = [
  ['welcome','Seu novo espaço de gestão está pronto','01-boas-vindas.html','operational'],
  ['patient_invitation','Você recebeu um convite seguro','02-convite-paciente.html','operational'],
  ['appointment_confirmed','Seu atendimento está confirmado','03-agendamento-confirmado.html','operational'],
  ['appointment_reminder','Seu atendimento está próximo','04-lembrete-agendamento.html','operational'],
  ['appointment_cancelled','O atendimento foi cancelado','05-agendamento-cancelado.html','operational'],
  ['payment_confirmed','Pagamento confirmado','06-pagamento-confirmado.html','finance'],
  ['payment_due_soon','Uma cobrança está próxima do vencimento','07-cobranca-proxima-do-vencimento.html','finance'],
  ['document_available','Seu documento está disponível','08-documento-disponivel.html','operational'],
  ['new_login','Detectamos um novo acesso','09-novo-login.html','security'],
] as const;

const requiredLegalText = 'CNPJ 65.610.762/0001-55';
const unresolvedPlaceholder = /\[\[[^\]]+\]\]/;

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const db = createClient(url, key, { auth: { persistSession: false } });
  const check = await db.rpc('verify_notification_webhook_secret', {
    p_channel: 'email',
    p_candidate: req.headers.get('x-neuronex-webhook-secret') || '',
  });
  if (check.error || check.data !== true) return json({ error: 'Unauthorized' }, 401);

  const base = 'https://raw.githubusercontent.com/neuronex-ai/neurobackup/main/docs/setup/templates-e-assinatura-de-email/02-operacionais-resend/';
  const rows = [];

  for (const [template_key, subject, filename, sender_profile] of templates) {
    const response = await fetch(base + filename, {
      headers: { 'User-Agent': 'NeuroNex-Template-Sync' },
    });
    if (!response.ok) {
      return json({ error: `Could not fetch ${filename}`, status: response.status }, 502);
    }

    const body_html = await response.text();
    if (unresolvedPlaceholder.test(body_html)) {
      return json({ error: `Unresolved legal placeholder in ${filename}` }, 422);
    }
    if (!body_html.includes(requiredLegalText)) {
      return json({ error: `Required legal footer missing in ${filename}` }, 422);
    }

    rows.push({
      template_key,
      subject,
      body_html,
      sender_profile,
      enabled: true,
      updated_at: new Date().toISOString(),
    });
  }

  const result = await db.from('system_email_templates').upsert(rows, {
    onConflict: 'template_key',
  });
  if (result.error) return json({ error: result.error.message }, 500);

  return json({
    success: true,
    synced: rows.length,
    legalFooterValidated: true,
  });
});
