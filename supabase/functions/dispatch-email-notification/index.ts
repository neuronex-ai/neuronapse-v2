import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const H = {'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,x-neuronex-webhook-secret'};
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers:H});
const esc = (value: unknown) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const keyify = (key:string) => key.replace(/([a-z0-9])([A-Z])/g,'$1_$2').replace(/[^a-zA-Z0-9]+/g,'_').toUpperCase();
const render = (html:string, vars:Record<string,unknown>) => Object.entries(vars).reduce((text,[key,value]) => text.replaceAll(`{{{${key}}}}`,esc(value)).replaceAll(`{{${key}}}`,esc(value)),html);
const sender = (profile:string, category:string) => profile === 'security' || category === 'seguranca'
  ? 'NeuroNex Segurança <seguranca@email.neuronex.site>'
  : profile === 'finance' || category === 'financeiro'
    ? 'NeuroFinance <financeiro@email.neuronex.site>'
    : profile === 'contact'
      ? 'Equipe NeuroNex <contato@email.neuronex.site>'
      : 'NeuroNex <notificacoes@email.neuronex.site>';
const generic = (title:string,message:string,link?:string|null) => `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b"><table width="100%"><tr><td align="center" style="padding:36px 14px"><table width="100%" style="max-width:600px;background:#fff;border:1px solid #e4e4e7;border-radius:24px;overflow:hidden"><tr><td style="background:#09090b;color:#fff;padding:28px 34px"><strong style="font-size:23px">NeuroNex</strong></td></tr><tr><td style="padding:38px 34px"><h1 style="margin:0 0 18px;font-size:27px">${esc(title)}</h1><p style="font-size:15px;line-height:24px;color:#3f3f46">${esc(message)}</p>${link ? `<a href="${esc(link)}" style="display:inline-block;margin-top:18px;padding:14px 24px;border-radius:12px;background:#09090b;color:#fff;text-decoration:none;font-weight:700">Abrir NeuroNex</a>` : ''}</td></tr><tr><td style="padding:22px 34px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:11px;color:#71717a">NEURONEX AI · CNPJ 65.610.762/0001-55 · Pinheiros, São Paulo - SP</td></tr></table></td></tr></table></body></html>`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null,{headers:H});
  if (req.method !== 'POST') return out({error:'Method not allowed'},405);
  const url = Deno.env.get('SUPABASE_URL') || '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const resend = Deno.env.get('RESEND_API_KEY') || '';
  if (!url || !service || !resend) return out({error:'Missing server configuration'},500);
  const db = createClient(url,service,{auth:{persistSession:false}});

  try {
    const check = await db.rpc('verify_notification_webhook_secret',{p_channel:'email',p_candidate:req.headers.get('x-neuronex-webhook-secret') || ''});
    if (check.error || check.data !== true) return out({error:'Unauthorized'},401);
    const input = await req.json();
    const id = input.notificationId || input.record?.id;
    if (!id) return out({error:'Notification id is required'},400);

    const found = await db.from('notifications').select('id,user_id,type,category,title,message,action_url,data,payload,email_status,email_attempts,created_at').eq('id',id).maybeSingle();
    if (found.error) throw found.error;
    const note = found.data;
    if (!note) return out({error:'Notification not found'},404);
    if (!['pending','failed'].includes(note.email_status)) return out({success:true,skipped:true,status:note.email_status});

    await db.from('notifications').update({email_status:'processing',email_attempts:Number(note.email_attempts || 0)+1,email_last_error:null}).eq('id',id);
    const account = await db.auth.admin.getUserById(note.user_id);
    const recipient = account.data.user?.email;
    if (!recipient) {
      await db.from('notifications').update({email_status:'no_recipient'}).eq('id',id);
      return out({success:true,status:'no_recipient'});
    }

    const profileResult = await db.from('profiles').select('first_name,last_name,full_name').eq('id',note.user_id).maybeSingle();
    const profile = profileResult.data;
    const recipientName = profile?.full_name || [profile?.first_name,profile?.last_name].filter(Boolean).join(' ') || 'profissional';
    const metadata = {...(note.payload || {}),...(note.data || {})} as Record<string,unknown>;
    const explicit = String(metadata.templateKey || metadata.template_key || '');
    const inferred = note.type === 'payment' ? 'payment_confirmed' : note.category === 'seguranca' ? 'new_login' : '';
    const templateKey = explicit || inferred;

    let subject = note.title;
    let html = generic(note.title,note.message,note.action_url);
    let senderProfile = note.category === 'financeiro' ? 'finance' : note.category === 'seguranca' ? 'security' : 'operational';

    if (templateKey) {
      const template = await db.from('system_email_templates').select('subject,body_html,sender_profile').eq('template_key',templateKey).eq('enabled',true).maybeSingle();
      if (template.data) {
        const vars:Record<string,unknown> = {
          RECIPIENT_NAME:recipientName,
          ACTION_URL:note.action_url ? new URL(note.action_url,'https://neuronexai.com.br').href : 'https://neuronexai.com.br/dashboard',
          PAYMENT_AMOUNT:Number.isFinite(Number(metadata.amountCents)) ? new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(metadata.amountCents)/100) : '',
          PAYMENT_REFERENCE:metadata.paymentReference || metadata.payment_reference || note.title,
          PAYMENT_DATE:new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(String(metadata.paidAt || note.created_at))),
          LOGIN_DATE:new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(note.created_at)),
          DEVICE_NAME:metadata.deviceName || metadata.device_name || 'Dispositivo não identificado',
          APPROXIMATE_LOCATION:metadata.approximateLocation || metadata.approximate_location || 'Não disponível',
        };
        for (const [key,value] of Object.entries(metadata)) vars[keyify(key)] = value;
        subject = render(template.data.subject,vars);
        html = render(template.data.body_html,vars);
        senderProfile = template.data.sender_profile;
      }
    }

    const from = sender(senderProfile,note.category);
    const response = await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resend}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[recipient],reply_to:'contato@email.neuronex.site',subject,html})});
    const payload = await response.json().catch(()=>({}));
    const status = response.ok ? 'sent' : 'failed';
    const error = response.ok ? null : payload.message || `Resend HTTP ${response.status}`;

    await db.from('notifications').update({email_status:status,email_sent_at:response.ok ? new Date().toISOString() : null,email_last_error:error}).eq('id',id);
    await db.from('email_delivery_logs').insert({user_id:note.user_id,notification_id:id,template_key:templateKey || null,recipient,provider:'resend',sender:from,status,provider_message_id:payload.id || null,error_message:error,metadata:{category:note.category,type:note.type}});
    return response.ok ? out({success:true,id:payload.id || null,templateKey:templateKey || null}) : out({error},502);
  } catch (error) {
    console.error('[dispatch-email-notification]',error);
    return out({error:error instanceof Error ? error.message : 'Unexpected error'},500);
  }
});
