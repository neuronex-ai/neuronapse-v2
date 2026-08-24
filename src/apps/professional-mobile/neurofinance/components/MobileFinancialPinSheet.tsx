import { useEffect, useState } from "react";
import { Fingerprint, LockKeyhole, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  canUseBiometricTransaction,
  forgetFinancialPinForBiometrics,
  getFinancialPinWithBiometrics,
  rememberFinancialPinForBiometrics,
} from "@/lib/native-mobile-security";
import { MobileFinanceSheet } from "../../shared/MobileFinancePrimitives";

export function MobileFinancialPinSheet({
  open,
  onOpenChange,
  title = "Confirme com seu PIN",
  description = "Digite o PIN financeiro de 6 dígitos para autorizar esta operação.",
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  busy?: boolean;
  onConfirm: (pin: string) => Promise<void> | void;
}) {
  const { user } = useAuth();
  const [pin, setPin] = useState("");
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);

  useEffect(() => {
    if (!open) setPin("");
  }, [open]);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      if (!open || !user?.id) {
        setBiometricReady(false);
        return;
      }

      const ready = await canUseBiometricTransaction(user.id).catch(() => false);
      if (!cancelled) setBiometricReady(ready);
    };

    void refresh();
    return () => {
      cancelled = true;
    };
  }, [open, user?.id]);

  const submit = async () => {
    if (!/^\d{6}$/.test(pin)) return;
    try {
      await onConfirm(pin);
      if (user?.id) {
        await rememberFinancialPinForBiometrics(user.id, pin).catch(() => undefined);
      }
    } catch {
      // The payment flow already shows the specific provider/PIN error.
    }
  };

  const confirmWithBiometrics = async () => {
    if (!user?.id) return;
    setBiometricBusy(true);
    try {
      const storedPin = await getFinancialPinWithBiometrics({
        userId: user.id,
        reason: title,
      });
      try {
        await onConfirm(storedPin);
      } catch {
        await forgetFinancialPinForBiometrics(user.id).catch(() => undefined);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Use o PIN financeiro para continuar.",
      );
    } finally {
      setBiometricBusy(false);
    }
  };

  const effectiveDescription = biometricReady
    ? "Use a biometria deste aparelho ou digite o PIN financeiro de 6 digitos."
    : description;

  return (
    <MobileFinanceSheet
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="h-auto max-h-[86dvh]"
      bodyClassName="pb-[calc(24px+env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto mt-7 flex h-12 w-12 items-center justify-center rounded-[18px] border border-border/40 bg-card dark:border-white/10 dark:bg-white/[0.03]">
        <LockKeyhole className="h-5 w-5" strokeWidth={1.6} />
      </div>
      <div className="mx-auto mt-5 max-w-sm text-center">
        <h2 className="text-xl font-black tracking-[-0.04em]">{title}</h2>
        <p className="mt-2 text-xs font-medium leading-relaxed text-muted-foreground/70">
          {effectiveDescription}
        </p>
      </div>
      <div className="mx-auto mt-7 w-full max-w-sm">
        {biometricReady ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy || biometricBusy}
            onClick={() => void confirmWithBiometrics()}
            className="mb-4 h-14 w-full rounded-[20px] text-xs font-semibold uppercase tracking-[0.14em]"
          >
            {biometricBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Fingerprint className="mr-2 h-4 w-4" />
            )}
            Usar biometria
          </Button>
        ) : null}
        <Input
          autoFocus
          value={pin}
          onChange={(event) =>
            setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
          inputMode="numeric"
          type="password"
          maxLength={6}
          placeholder="••••••"
          aria-label="PIN financeiro"
          className="h-16 rounded-[20px] border-border/50 bg-card text-center text-2xl tracking-[0.5em]"
        />
        <Button
          type="button"
          disabled={!/^\d{6}$/.test(pin) || busy}
          onClick={() => void submit()}
          className="mt-4 h-14 w-full rounded-[20px] text-xs font-semibold uppercase tracking-[0.16em]"
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Autorizar operação
        </Button>
      </div>
    </MobileFinanceSheet>
  );
}
