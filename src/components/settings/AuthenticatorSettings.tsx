import { Switch } from '@/components/ui/switch';
import { getVerifiedTotpFactor } from '@/hooks/use-totp-mfa';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TotpMfaDialog } from './TotpMfaDialog';

export const AuthenticatorSettings = () => {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<'enroll' | 'disable'>('enroll');
  const [open, setOpen] = useState(false);

  const refresh = async () => setEnabled(Boolean(await getVerifiedTotpFactor()));
  useEffect(() => { void refresh(); }, []);

  const toggle = (next: boolean) => {
    setMode(next ? 'enroll' : 'disable');
    setOpen(true);
  };

  return <><div className="rounded-[24px] border border-border/50 bg-card p-6 md:p-8"><div className="flex items-center gap-5"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><ShieldCheck className="h-7 w-7" /></div><div className="flex-1"><div className="flex items-center gap-2"><h3 className="text-lg font-bold">Autenticação em duas etapas</h3>{enabled ? <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-500">ATIVO</span> : null}</div><p className="mt-1 text-sm text-muted-foreground">Proteja o acesso com Google Authenticator ou outro aplicativo TOTP.</p></div><Switch checked={enabled} onCheckedChange={toggle} /></div></div><TotpMfaDialog open={open} mode={mode} onOpenChange={setOpen} onSuccess={refresh} /></>;
};
