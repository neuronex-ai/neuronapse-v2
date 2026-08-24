import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";

import { SubscriptionUpsellDialog } from "@/components/subscription/SubscriptionUpsellDialog";
import { PROFESSIONAL_PLAN_PRICE_LABEL } from "@/lib/subscription-plans";
import {
  isValidBrazilianPhoneLength,
  isValidBillingAddress,
  isValidCpfCnpjLength,
  type BillingAddressPayload,
  normalizeCpfCnpj,
  normalizePhone,
  normalizePostalCode,
  startSubscriptionCheckout,
} from "@/lib/subscription-checkout";

interface UpgradePlanModalProps {
  currentPlan: string;
  children: ReactNode;
}

const WHATSAPP_NUMBER = "5547988730611";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Gostaria de saber mais sobre o plano Enterprise do NeuroNex.")}`;

const PROFESSIONAL_FEATURES = [
  "Pacientes ilimitados",
  "Synapse texto e voz com limites maiores",
  "Teleconsulta HD",
  "Gestão Financeira avançada",
  "Portal do Paciente",
];

export const UpgradePlanModal = ({ currentPlan, children }: UpgradePlanModalProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState<BillingAddressPayload>({});
  const updateBillingAddress = useCallback((patch: Partial<BillingAddressPayload>) => {
    setBillingAddress((current) => ({ ...current, ...patch }));
  }, []);

  const handleTrigger = () => {
    if (currentPlan === "Professional") {
      window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");
      return;
    }
    setOpen(true);
  };

  const handleCheckout = async () => {
    if (!isValidCpfCnpjLength(cpfCnpj)) {
      toast.error("Informe um CPF ou CNPJ válido para continuar.");
      return;
    }

    if (!isValidBrazilianPhoneLength(phone)) {
      toast.error("Informe um telefone com DDD para continuar.");
      return;
    }

    if (!isValidBillingAddress(billingAddress)) {
      toast.error("Informe CEP, endereço, número e bairro para continuar.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await startSubscriptionCheckout({
        planId: "Professional",
        cpfCnpj: normalizeCpfCnpj(cpfCnpj),
        phone: normalizePhone(phone),
        address: billingAddress.address?.trim(),
        addressNumber: billingAddress.addressNumber?.trim(),
        complement: billingAddress.complement?.trim(),
        province: billingAddress.province?.trim(),
        postalCode: normalizePostalCode(billingAddress.postalCode || ""),
        city: billingAddress.city?.trim(),
        state: billingAddress.state?.trim(),
      });

      if (result.url) {
        window.location.href = result.url;
        return;
      }

      if (result.requiresDocument || result.code === "customer_document_required") {
        toast.error("Informe um CPF ou CNPJ válido para abrir o checkout.");
        return;
      }

      if (result.requiresPhone || result.code === "customer_phone_required") {
        toast.error("Informe um telefone válido para abrir o checkout.");
        return;
      }

      if (result.requiresAddress || result.code === "customer_address_required") {
        toast.error("Informe um endereço completo para abrir o checkout.");
        return;
      }

      if (result.trialEndsAt) {
        toast.info("Seu teste grátis ainda está ativo.");
        return;
      }

      toast.error(result.error || "Erro ao iniciar pagamento. Tente novamente.");
    } catch (error) {
      console.error("upgrade-plan-checkout:error", error);
      toast.error("Erro ao iniciar pagamento. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <span onClick={handleTrigger} className="contents">
        {children}
      </span>

      <SubscriptionUpsellDialog
        open={open}
        onOpenChange={setOpen}
        eyebrow="Upgrade de plano"
        title="Desbloqueie o Professional"
        description="Evolua sua prática com ferramentas clínicas, financeiras e operacionais integradas."
        planName="Professional"
        planDescription="Para consultórios em crescimento"
        priceLabel={PROFESSIONAL_PLAN_PRICE_LABEL}
        features={PROFESSIONAL_FEATURES}
        cpfCnpj={cpfCnpj}
        onCpfCnpjChange={setCpfCnpj}
        phone={phone}
        onPhoneChange={setPhone}
        billingAddress={billingAddress}
        onBillingAddressChange={updateBillingAddress}
        checkoutLoading={isLoading}
        onCheckout={handleCheckout}
      />
    </>
  );
};
