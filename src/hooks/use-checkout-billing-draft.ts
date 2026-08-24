import { useCallback, useEffect, useState } from "react";
import {
  readCheckoutBillingDraft,
  saveCheckoutBillingDraft,
  type BillingAddressPayload,
} from "@/lib/subscription-checkout";

export function useCheckoutBillingDraft() {
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState<BillingAddressPayload>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    readCheckoutBillingDraft()
      .then((draft) => {
        if (cancelled || !draft) return;
        setCpfCnpj(draft.cpfCnpj || "");
        setPhone(draft.phone || "");
        setBillingAddress(draft.billingAddress || {});
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;

    const timeoutId = window.setTimeout(() => {
      void saveCheckoutBillingDraft({
        cpfCnpj,
        phone,
        billingAddress,
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [billingAddress, cpfCnpj, loaded, phone]);

  const updateBillingAddress = useCallback((patch: Partial<BillingAddressPayload>) => {
    setBillingAddress((current) => ({ ...current, ...patch }));
  }, []);

  const persistBillingDraft = useCallback(() => saveCheckoutBillingDraft({
    cpfCnpj,
    phone,
    billingAddress,
  }), [billingAddress, cpfCnpj, phone]);

  return {
    cpfCnpj,
    setCpfCnpj,
    phone,
    setPhone,
    billingAddress,
    updateBillingAddress,
    persistBillingDraft,
  };
}
