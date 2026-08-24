import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Loader2, QrCode, RefreshCw, Share2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useNeuroFinanceStaticPixQrCode } from "@/hooks/use-neurofinance-static-pix";
import { formatMoneyInput, moneyInputToNumber } from "@/lib/financial-input";
import { formatCurrency } from "@/lib/utils";
import { MobileStatusBanner } from "../../components/MobilePagePrimitives";

export function MobilePixStaticQrCode() {
  const mutation = useNeuroFinanceStaticPixQrCode();
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [expiration, setExpiration] = useState("3600");
  const [multiplePayments, setMultiplePayments] = useState(true);
  const [result, setResult] = useState<Awaited<ReturnType<typeof mutation.mutateAsync>> | null>(null);
  const [copied, setCopied] = useState(false);

  const numericValue = moneyInputToNumber(value);

  const generate = async () => {
    try {
      const generated = await mutation.mutateAsync({
        value: numericValue > 0 ? numericValue : undefined,
        description: description.trim() || undefined,
        expirationSeconds: Number(expiration) || undefined,
        allowsMultiplePayments: multiplePayments,
        externalReference: `mobile-${crypto.randomUUID()}`,
      });
      setResult(generated);
    } catch {
      // A mensagem operacional é apresentada pelo hook.
    }
  };

  const copyCode = async () => {
    if (!result?.pix_copy_paste) return;
    try {
      await navigator.clipboard.writeText(result.pix_copy_paste);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast.success("Pix Copia e Cola copiado.");
    } catch {
      toast.error("Não foi possível copiar o código neste dispositivo.");
    }
  };

  const share = async () => {
    if (!result?.pix_copy_paste) return;
    const text = `${description.trim() || "Recebimento Pix NeuroFinance"}${result.amount ? `\n${formatCurrency(result.amount)}` : ""}\n\n${result.pix_copy_paste}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Receber via Pix", text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyCode();
  };

  const reset = () => {
    setResult(null);
    setCopied(false);
    mutation.reset();
  };

  return (
    <div className="space-y-5">
      <MobileStatusBanner
        variant="info"
        title="QR Code para recebimento"
        description="Nome e CPF do pagador não são necessários. O QR usa uma chave Pix ativa da sua própria conta NeuroFinance."
      />

      <AnimatePresence mode="wait">
        {!result ? (
          <motion.section
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-5 rounded-[28px] border border-border/40 bg-card/75 p-5 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground/55">Valor opcional</p>
              <div className="relative mt-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground/50">R$</span>
                <Input
                  value={value}
                  onChange={(event) => setValue(formatMoneyInput(event.target.value))}
                  inputMode="decimal"
                  placeholder="Deixe vazio para valor livre"
                  className="h-14 rounded-[18px] pl-12 text-xl font-black"
                />
              </div>
              <p className="mt-2 text-[9px] font-medium leading-relaxed text-muted-foreground/60">
                Com valor livre, o pagador informa quanto deseja enviar no aplicativo bancário.
              </p>
            </div>

            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground/55">Descrição</p>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value.slice(0, 140))}
                placeholder="Ex.: Pagamento da sessão"
                className="mt-2 h-12 rounded-[16px]"
              />
            </div>

            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground/55">Validade</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { value: "1800", label: "30 minutos" },
                  { value: "3600", label: "1 hora" },
                  { value: "86400", label: "24 horas" },
                  { value: "604800", label: "7 dias" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setExpiration(option.value)}
                    className={`min-h-11 rounded-xl border px-3 text-[8px] font-black uppercase tracking-[0.11em] ${expiration === option.value ? "border-foreground bg-foreground text-background" : "border-border/40 bg-card text-muted-foreground dark:border-white/10"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-[18px] border border-border/40 bg-foreground/[0.025] p-4 dark:border-white/10">
              <div>
                <p className="text-xs font-black text-foreground">Permitir vários pagamentos</p>
                <p className="mt-1 text-[9px] font-medium leading-relaxed text-muted-foreground/60">O mesmo QR poderá ser reutilizado até expirar.</p>
              </div>
              <Switch checked={multiplePayments} onCheckedChange={setMultiplePayments} />
            </div>

            <Button
              type="button"
              onClick={generate}
              disabled={mutation.isPending}
              className="h-14 w-full rounded-[18px] text-[9px] font-black uppercase tracking-[0.16em]"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><QrCode className="mr-2 h-4 w-4" /> Gerar QR Code</>}
            </Button>
          </motion.section>
        ) : (
          <motion.section
            key="result"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-5 rounded-[28px] border border-border/40 bg-card/80 p-5 text-center dark:border-white/10 dark:bg-white/[0.035]"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] bg-emerald-500/10 text-emerald-500"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-emerald-500">Pronto para receber</p>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-foreground">
                {result.amount ? formatCurrency(result.amount) : "Valor definido pelo pagador"}
              </h3>
              {description ? <p className="mt-2 text-xs font-medium text-muted-foreground">{description}</p> : null}
            </div>

            {result.pix_qr_code ? (
              <div className="mx-auto w-fit rounded-[24px] bg-white p-4 shadow-xl">
                <img src={`data:image/png;base64,${result.pix_qr_code}`} alt="QR Code Pix" className="h-52 w-52" />
              </div>
            ) : null}

            {result.pix_copy_paste ? (
              <button type="button" onClick={copyCode} className="w-full rounded-[18px] border border-border/40 bg-foreground/[0.025] p-4 text-left dark:border-white/10">
                <p className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground/55">Pix Copia e Cola</p>
                <p className="mt-2 line-clamp-3 break-all font-mono text-[9px] text-foreground/75">{result.pix_copy_paste}</p>
                <span className="mt-3 inline-flex items-center text-[8px] font-black uppercase tracking-[0.12em] text-foreground">
                  {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                  {copied ? "Copiado" : "Copiar código"}
                </span>
              </button>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" onClick={share} className="h-12 rounded-[16px] text-[8px] font-black uppercase tracking-[0.12em]"><Share2 className="mr-2 h-4 w-4" /> Compartilhar</Button>
              <Button type="button" onClick={reset} className="h-12 rounded-[16px] text-[8px] font-black uppercase tracking-[0.12em]"><RefreshCw className="mr-2 h-4 w-4" /> Novo QR</Button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
