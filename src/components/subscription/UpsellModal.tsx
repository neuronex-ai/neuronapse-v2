import { useState } from "react";
import { toast } from "sonner";
import {
  FeatureKey,
  FEATURE_NAMES,
  FEATURE_UPSELL_PLANS,
  PLAN_FEATURES,
} from "@/types/subscription";
import { PLAN_PRICE_LABELS } from "@/lib/subscription-plans";
import {
  isValidBrazilianPhoneLength,
  isValidBillingAddress,
  isValidCpfCnpjLength,
  normalizeCpfCnpj,
  normalizePhone,
  normalizePostalCode,
  startSubscriptionCheckout,
} from "@/lib/subscription-checkout";
import { SubscriptionUpsellDialog } from "@/components/subscription/SubscriptionUpsellDialog";
import { useCheckoutBillingDraft } from "@/hooks/use-checkout-billing-draft";

interface UpsellModalProps {
  feature: FeatureKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLAN_DESCRIPTIONS = {
  Essential: "Ideal para quem está começando",
  Professional: "Para consultórios em crescimento",
  Enterprise: "Gestão completa para clínicas",
};

export const UpsellModal = ({ feature, open, onOpenChange }: UpsellModalProps) => {
  const requiredPlan = FEATURE_UPSELL_PLANS[feature];
  const featureName = FEATURE_NAMES[feature];
  const [isLoading, setIsLoading] = useState(false);
  const {
    cpfCnpj,
    setCpfCnpj,
    phone,
    setPhone,
    billingAddress,
    updateBillingAddress,
    persistBillingDraft,
  } = useCheckoutBillingDraft();

  const handleUpgrade = async () => {
    if (requiredPlan !== "Professional") {
      toast.info("Para o plano Enterprise, fale com nossa equipe.");
      return;
    }

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
      await persistBillingDraft();
      const result = await startSubscriptionCheckout({
        planId: requiredPlan,
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

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.url) {
        window.location.href = result.url;
        return;
      }

      toast.error("Erro ao criar sessão de pagamento.");
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Erro ao iniciar checkout. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const planFeatures = PLAN_FEATURES[requiredPlan];
  const enabledFeatures = Object.entries(FEATURE_NAMES)
    .filter(([key]) => {
      const featureKey = key as FeatureKey;
      if (featureKey === "unlimited_patients") {
        return planFeatures.maxPatients === "unlimited";
      }
      const planFeatureKey = `has${featureKey
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("")}` as keyof typeof planFeatures;
      return planFeatures[planFeatureKey] === true;
    })
    .map(([, name]) => name);

  return (
    <SubscriptionUpsellDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Funcionalidade premium"
      title="Desbloqueie o Professional"
      description="Faça o upgrade para liberar este recurso e manter sua operação clínica sem interrupções."
      featureName={featureName}
      planName={requiredPlan}
      planDescription={PLAN_DESCRIPTIONS[requiredPlan]}
      priceLabel={PLAN_PRICE_LABELS[requiredPlan] || "Sob consulta"}
      features={enabledFeatures}
      cpfCnpj={cpfCnpj}
      onCpfCnpjChange={setCpfCnpj}
      phone={phone}
      onPhoneChange={setPhone}
      billingAddress={billingAddress}
      onBillingAddressChange={updateBillingAddress}
      checkoutLoading={isLoading}
      onCheckout={handleUpgrade}
    />
  );
};
