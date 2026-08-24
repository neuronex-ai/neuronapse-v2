"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/context/SubscriptionContext";
import { PROFESSIONAL_PLAN_PRICE_LABEL } from "@/lib/subscription-plans";
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

const PROFESSIONAL_FEATURES = [
  "Synapse texto e voz com limites maiores",
  "NeuroFinance, cobranças e rotinas financeiras",
  "NFS-e automática e automações operacionais",
  "Portal do Paciente e teleconsulta HD",
];

export const TrialExpiredUpsell = () => {
  const {
    isLoading,
    isDevAccount,
    requiresUpsell,
    status,
    checkoutUrl,
    message,
    refreshSubscription,
  } = useSubscription();
  const [open, setOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [freeLoading, setFreeLoading] = useState(false);
  const {
    cpfCnpj,
    setCpfCnpj,
    phone,
    setPhone,
    billingAddress,
    updateBillingAddress,
    persistBillingDraft,
  } = useCheckoutBillingDraft();

  useEffect(() => {
    if (!isLoading && !isDevAccount && requiresUpsell) {
      setOpen(true);
    }
  }, [isDevAccount, isLoading, requiresUpsell]);

  const canContinueFree = ["trial_expired", "blocked", "canceled", "internal_error"].includes(status);
  const title = status === "payment_pending" || status === "checkout_pending"
    ? "Finalize sua assinatura"
    : status === "past_due" || status === "grace_period"
      ? "Regularize sua assinatura"
      : "Continue com o Professional";
  const eyebrow = status === "trial_expired" ? "Teste grátis encerrado" : "Assinatura pendente";
  const description = message || `Assine o Professional por ${PROFESSIONAL_PLAN_PRICE_LABEL} ou permaneça no Essential gratuito.`;

  const startCheckout = async () => {
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

    setCheckoutLoading(true);
    try {
      await persistBillingDraft();
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

      if (
        result.requiresDocument ||
        result.code === "customer_document_required" ||
        /cpf|cnpj|documento/i.test(result.error || "")
      ) {
        toast.error("Informe um CPF ou CNPJ válido para abrir o checkout.");
        return;
      }

      if (
        result.requiresPhone ||
        result.code === "customer_phone_required" ||
        /telefone|phone|celular/i.test(result.error || "")
      ) {
        toast.error("Informe um telefone válido para abrir o checkout.");
        return;
      }

      if (
        result.requiresAddress ||
        result.code === "customer_address_required" ||
        /endere|address|postal|cep|bairro|province/i.test(result.error || "")
      ) {
        toast.error("Informe um endereço completo para abrir o checkout.");
        return;
      }

      if (result.trialEndsAt) {
        toast.info("Seu teste grátis ainda está ativo.");
        return;
      }

      toast.error(result.error || "Não conseguimos abrir o checkout agora.");
    } catch (error) {
      console.error("trial-expired-checkout:error", error);
      toast.error("Não conseguimos iniciar a assinatura. Tente novamente.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const continueFree = async () => {
    setFreeLoading(true);
    try {
      const { error } = await supabase.functions.invoke("continue-free-plan", {
        body: {},
      });
      if (error) throw error;
      await refreshSubscription();
      setOpen(false);
      toast.success("Você continuou no plano gratuito.");
    } catch (error) {
      console.error("trial-expired-continue-free:error", error);
      toast.error("Não conseguimos atualizar seu plano agora.");
    } finally {
      setFreeLoading(false);
    }
  };

  if (isLoading || isDevAccount || !requiresUpsell) return null;

  return (
    <SubscriptionUpsellDialog
      open={open}
      onOpenChange={setOpen}
      eyebrow={eyebrow}
      title={title}
      description={description}
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
      checkoutUrl={checkoutUrl}
      checkoutLoading={checkoutLoading}
      freeLoading={freeLoading}
      canContinueFree={canContinueFree}
      onCheckout={startCheckout}
      onContinueFree={continueFree}
    />
  );
};

export default TrialExpiredUpsell;
