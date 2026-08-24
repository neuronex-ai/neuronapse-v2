"use client";

import { useState } from "react";
import { ArrowRight, KeyRound, Landmark, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatDocumentInput, formatPixKeyInput, normalizePixKeyInput, onlyDigits, type PixKeyInputType } from "@/lib/financial-input";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

interface NeuroFinanceDestinationSetupProps {
  onComplete: () => void | Promise<void>;
}

export function NeuroFinanceDestinationSetup({ onComplete }: NeuroFinanceDestinationSetupProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [bank, setBank] = useState({
    holderName: "",
    cpfCnpj: "",
    bankCode: "",
    agency: "",
    account: "",
    digit: "",
  });
  const [pixKeyType, setPixKeyType] = useState<PixKeyInputType>("cpf");
  const [pixKey, setPixKey] = useState("");

  const pixKeyTypes: Array<{ value: PixKeyInputType; label: string; hint: string }> = [
    { value: "cpf", label: "CPF", hint: "000.000.000-00" },
    { value: "cnpj", label: "CNPJ", hint: "00.000.000/0000-00" },
    { value: "email", label: "E-mail", hint: "voce@email.com" },
    { value: "telefone", label: "Telefone", hint: "+55 (00) 00000-0000" },
    { value: "evp", label: "Aleatória", hint: "Chave aleatória Pix" },
  ];

  const setBankField = (field: keyof typeof bank, value: string) => {
    setBank((current) => ({ ...current, [field]: value }));
  };

  const hasBankData = Object.values(bank).some((value) => value.trim());
  const hasPixData = pixKey.trim().length > 0;

  const save = async (skip = false) => {
    if (!skip && !hasBankData && !hasPixData) {
      toast.error("Informe uma conta bancária, uma chave Pix ou escolha configurar depois.");
      return;
    }

    if (hasBankData && (!bank.holderName.trim() || onlyDigits(bank.bankCode).length !== 3 || !onlyDigits(bank.agency) || !onlyDigits(bank.account))) {
      toast.error("Para salvar conta bancária, preencha titular, banco, agência e conta.");
      return;
    }

    if (hasPixData && !normalizePixKeyInput(pixKey, pixKeyType)) {
      toast.error("Informe uma chave Pix válida.");
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("neurofinance-post-onboarding", {
        body: {
          action: "complete",
          bank: hasBankData ? {
            holderName: bank.holderName.trim(),
            cpfCnpj: onlyDigits(bank.cpfCnpj),
            bankCode: onlyDigits(bank.bankCode),
            agency: onlyDigits(bank.agency),
            account: onlyDigits(bank.account),
            digit: onlyDigits(bank.digit),
            accountType: "CONTA_CORRENTE",
          } : undefined,
          pix: hasPixData ? {
            key: pixKey.trim(),
            normalizedKey: normalizePixKeyInput(pixKey, pixKeyType),
            type: pixKeyType,
          } : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(skip ? "Você poderá configurar seus dados de recebimento depois." : "Dados de recebimento salvos.");
      await onComplete();
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "save"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-8 space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[28px] border border-zinc-200/75 bg-zinc-50/80 p-5 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
              <Landmark className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">Conta bancária</p>
              <h4 className="text-sm font-black text-zinc-950 dark:text-white">Para saques por banco</h4>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Titular"><Input value={bank.holderName} onChange={(e) => setBankField("holderName", e.target.value)} /></Field>
            <Field label="CPF/CNPJ"><Input value={bank.cpfCnpj} onChange={(e) => setBankField("cpfCnpj", formatDocumentInput(e.target.value))} /></Field>
            <Field label="Banco"><Input maxLength={3} value={bank.bankCode} onChange={(e) => setBankField("bankCode", onlyDigits(e.target.value).slice(0, 3))} /></Field>
            <Field label="Agência"><Input value={bank.agency} onChange={(e) => setBankField("agency", onlyDigits(e.target.value, 10))} /></Field>
            <Field label="Conta"><Input value={bank.account} onChange={(e) => setBankField("account", onlyDigits(e.target.value, 18))} /></Field>
            <Field label="Dígito"><Input maxLength={2} value={bank.digit} onChange={(e) => setBankField("digit", onlyDigits(e.target.value).slice(0, 2))} /></Field>
          </div>
        </section>

        <section className="rounded-[28px] border border-zinc-200/75 bg-zinc-50/80 p-5 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">Chave Pix</p>
              <h4 className="text-sm font-black text-zinc-950 dark:text-white">Para saques rápidos</h4>
            </div>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {pixKeyTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => {
                  setPixKeyType(type.value);
                  setPixKey((current) => formatPixKeyInput(current, type.value));
                }}
                className={`h-10 rounded-2xl border text-[9px] font-black uppercase tracking-[0.12em] transition-colors ${
                  pixKeyType === type.value
                    ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                    : "border-zinc-200 bg-white/70 text-zinc-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
          <Field label="Sua chave Pix pessoal">
            <Input value={pixKey} onChange={(e) => setPixKey(formatPixKeyInput(e.target.value, pixKeyType))} placeholder={pixKeyTypes.find((type) => type.value === pixKeyType)?.hint || "Digite a chave Pix"} />
          </Field>
          <p className="mt-4 rounded-2xl border border-zinc-200/70 bg-white/70 p-4 text-[11px] font-semibold leading-relaxed text-zinc-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-zinc-400">
            Você pode informar só a chave Pix, só a conta bancária ou ambos. Esses dados ficam disponíveis em Ajustes &gt; Conta bancária e na tela de Saques.
          </p>
        </section>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-zinc-200/70 pt-5 dark:border-white/10 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => save(true)}
          disabled={isSaving}
          className="h-12 rounded-2xl px-5 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-40 dark:hover:bg-white/[0.06] dark:hover:text-white"
        >
          Configurar depois
        </button>
        <button
          type="button"
          onClick={() => save(false)}
          disabled={isSaving}
          className="flex h-12 items-center justify-center gap-3 rounded-2xl bg-zinc-950 px-6 text-[10px] font-black uppercase tracking-[0.22em] text-white shadow-2xl transition-all hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-zinc-950"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Salvar e acessar
          {!isSaving ? <ArrowRight className="h-4 w-4" /> : null}
        </button>
      </div>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <Label className="ml-1 text-[8px] font-black uppercase tracking-[0.18em] text-zinc-400">{label}</Label>
    <div className="[&_input]:h-11 [&_input]:rounded-2xl [&_input]:border-zinc-200 [&_input]:bg-white/75 [&_input]:text-xs [&_input]:font-bold dark:[&_input]:border-white/10 dark:[&_input]:bg-white/[0.04]">
      {children}
    </div>
  </div>
);
