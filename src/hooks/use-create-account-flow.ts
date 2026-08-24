import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import {
  enableBiometricSignIn,
  getBiometricStatus,
  isBiometricStatusUsable,
  type BiometricStatus,
} from "@/lib/native-mobile-security";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export type ProfessionalContext =
  | "individual_professional"
  | "psychology_student";

export type GenderIdentity =
  | "female"
  | "male"
  | "non_binary"
  | "prefer_not_to_say";

export type CreateAccountStep = "identity" | "password" | "success";

export type EmailAvailabilityStatus =
  | "idle"
  | "checking"
  | "available"
  | "exists"
  | "invalid"
  | "error";

export type EmailAvailability = {
  status: EmailAvailabilityStatus;
  exists: boolean;
  message?: string;
};

export type CreateAccountDraft = {
  fullName: string;
  email: string;
  recoveryEmail: string;
  phone: string;
  genderIdentity: GenderIdentity | "";
  professionalContext: ProfessionalContext | "";
  acceptedTerms: boolean;
};

export type PasswordStrength = {
  minLength: boolean;
  lower: boolean;
  upper: boolean;
  special: boolean;
  score: number;
};

type SignupStartResponse = {
  verificationId: string;
  expiresIn: number;
  resendCooldown?: number;
};

type SignupVerifyResponse = {
  signupToken: string;
  expiresIn: number;
};

type SignupCompleteResponse = {
  userId: string;
  email: string;
};

const STORAGE_KEY = "neuronex.create-account.draft.v2";
const SPECIAL_CHARS = /[@#<!$%&*;/?:]/;
const emptyAvailability: EmailAvailability = { status: "idle", exists: false };

export const emptyCreateAccountDraft: CreateAccountDraft = {
  fullName: "",
  email: "",
  recoveryEmail: "",
  phone: "",
  genderIdentity: "",
  professionalContext: "",
  acceptedTerms: false,
};

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function maskBrazilPhone(value: string) {
  const digits = onlyDigits(value).replace(/^55/, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function getPasswordStrength(password: string): PasswordStrength {
  const checks = {
    minLength: password.length >= 8,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    special: SPECIAL_CHARS.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  return { ...checks, score };
}

function readDraftFromStorage() {
  if (typeof window === "undefined") return emptyCreateAccountDraft;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyCreateAccountDraft;
  try {
    return { ...emptyCreateAccountDraft, ...JSON.parse(raw) } as CreateAccountDraft;
  } catch {
    return emptyCreateAccountDraft;
  }
}

function writeDraftToStorage(draft: CreateAccountDraft) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

function clearDraftStorage() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

function validateEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toE164Phone(phone: string) {
  const digits = onlyDigits(phone).replace(/^55/, "").slice(0, 11);
  return digits ? `+55${digits}` : "";
}

async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return data as T;

  let message = error.message || "Não foi possível concluir esta ação.";
  const context = (error as { context?: Response }).context;
  if (context) {
    try {
      const payload = await context.clone().json();
      if (typeof payload?.error === "string") message = payload.error;
    } catch {
      try {
        const text = await context.clone().text();
        if (text) message = text;
      } catch {
        // Keep the default message.
      }
    }
  }
  throw new Error(message);
}

async function checkEmailAvailability(email: string): Promise<EmailAvailability> {
  if (!email) return emptyAvailability;
  if (!validateEmail(email)) {
    return {
      status: "invalid",
      exists: false,
      message: "Digite um e-mail válido.",
    };
  }

  try {
    const result = await invokeFunction<{ status: EmailAvailabilityStatus; exists: boolean; error?: string }>(
      "signup-email-status",
      { email },
    );
    return {
      status: result.exists ? "exists" : "available",
      exists: Boolean(result.exists),
      message: result.error,
    };
  } catch (error) {
    return {
      status: "error",
      exists: false,
      message: error instanceof Error ? error.message : "Não conseguimos verificar este e-mail agora.",
    };
  }
}

export function useCreateAccountFlow() {
  const isMobile = useIsMobile();
  const [step, setStep] = useState<CreateAccountStep>("identity");
  const [draft, setDraftState] = useState<CreateAccountDraft>(() => readDraftFromStorage());
  const [emailAvailability, setEmailAvailability] = useState<EmailAvailability>(emptyAvailability);
  const [recoveryEmailAvailability, setRecoveryEmailAvailability] = useState<EmailAvailability>(emptyAvailability);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const setDraft = useCallback((updates: Partial<CreateAccountDraft>) => {
    setDraftState((current) => {
      const next = { ...current, ...updates };
      writeDraftToStorage(next);
      return next;
    });
  }, []);

  const validateIdentity = useCallback(() => {
    const email = normalizeEmail(draft.email);
    const recoveryEmail = normalizeEmail(draft.recoveryEmail);
    const digits = onlyDigits(draft.phone).replace(/^55/, "");

    if (draft.fullName.trim().split(/\s+/).length < 2) {
      throw new Error("Informe seu nome completo.");
    }
    if (!validateEmail(email)) {
      throw new Error("Informe um e-mail válido.");
    }
    if (emailAvailability.status === "exists") {
      throw new Error("Já existe uma conta com este e-mail. Faça login para continuar.");
    }
    if (emailAvailability.status === "checking") {
      throw new Error("Aguarde a verificação do e-mail.");
    }
    if (recoveryEmail) {
      if (!validateEmail(recoveryEmail)) {
        throw new Error("Informe um e-mail de recuperação válido ou deixe em branco.");
      }
      if (email === recoveryEmail) {
        throw new Error("Use um e-mail de recuperação diferente do e-mail principal.");
      }
    }
    if (digits.length < 10) {
      throw new Error("Informe um celular ou WhatsApp válido.");
    }
    if (!draft.genderIdentity) {
      throw new Error("Selecione seu gênero ou escolha preferir não informar.");
    }
    if (!draft.professionalContext) {
      throw new Error("Selecione a opção que melhor descreve você.");
    }
    if (!draft.acceptedTerms) {
      throw new Error("Aceite a Política de Privacidade e os Termos de Uso para continuar.");
    }
  }, [draft, emailAvailability.status]);

  const sendVerificationEmail = useCallback(async () => {
    validateIdentity();
    setLoading(true);
    try {
      const normalizedDraft = {
        ...draft,
        email: normalizeEmail(draft.email),
        recoveryEmail: normalizeEmail(draft.recoveryEmail),
        phone: maskBrazilPhone(draft.phone),
      };
      writeDraftToStorage(normalizedDraft);
      setDraftState(normalizedDraft);

      const result = await invokeFunction<SignupStartResponse>("signup-start", {
        fullName: normalizedDraft.fullName,
        email: normalizedDraft.email,
        recoveryEmail: normalizedDraft.recoveryEmail || null,
        phone: toE164Phone(normalizedDraft.phone),
        genderIdentity: normalizedDraft.genderIdentity,
        professionalContext: normalizedDraft.professionalContext,
      });

      setVerificationId(result.verificationId);
      setEmailDialogOpen(true);
      setResendCooldown(result.resendCooldown || 45);
      setOtp("");
    } finally {
      setLoading(false);
    }
  }, [draft, validateIdentity]);

  const verifyEmailCode = useCallback(async () => {
    const email = normalizeEmail(draft.email);
    const code = otp.replace(/\D/g, "");
    if (!verificationId || !email || code.length < 6) {
      throw new Error("Digite o código de confirmação recebido por e-mail.");
    }

    setLoading(true);
    try {
      const result = await invokeFunction<SignupVerifyResponse>("signup-verify", {
        verificationId,
        email,
        code,
      });

      setSignupToken(result.signupToken);
      setEmailDialogOpen(false);
      setStep("password");
      setOtp("");
    } finally {
      setLoading(false);
    }
  }, [draft.email, otp, verificationId]);

  const resendVerification = useCallback(async () => {
    if (resendCooldown > 0) return;
    await sendVerificationEmail();
  }, [resendCooldown, sendVerificationEmail]);

  const createPassword = useCallback(async () => {
    if (passwordStrength.score < 4) {
      throw new Error("Crie uma senha que cumpra todos os requisitos.");
    }
    if (password !== confirmPassword) {
      throw new Error("As senhas não conferem.");
    }
    if (!signupToken) {
      throw new Error("Sua confirmação expirou. Confirme o e-mail novamente.");
    }

    setLoading(true);
    try {
      await invokeFunction<SignupCompleteResponse>("signup-complete", {
        signupToken,
        password,
      });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(draft.email),
        password,
      });

      if (error) throw error;
      if (!data.session?.user) throw new Error("Conta criada, mas não conseguimos abrir sua sessão.");

      if (isMobile && biometricEnabled) {
        try {
          await enableBiometricSignIn({
            userId: data.session.user.id,
            email: data.session.user.email,
            session: data.session,
          });
        } catch (error) {
          setBiometricEnabled(false);
          toast.error(
            error instanceof Error
              ? `${error.message} Você pode configurar depois em Ajustes > Login e Segurança.`
              : "Não foi possível ativar a biometria agora. Você pode configurar depois em Ajustes > Login e Segurança.",
          );
        }
      }

      setSession(data.session);
    } finally {
      setLoading(false);
    }
  }, [
    biometricEnabled,
    confirmPassword,
    draft.email,
    isMobile,
    password,
    passwordStrength.score,
    signupToken,
  ]);

  const completeSignup = useCallback(() => {
    clearDraftStorage();
    setStep("success");
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    void getBiometricStatus()
      .then(setBiometricStatus)
      .catch(() => setBiometricStatus(null));
  }, [isMobile]);

  useEffect(() => {
    const email = normalizeEmail(draft.email);
    if (!email) {
      setEmailAvailability(emptyAvailability);
      return;
    }
    if (!validateEmail(email)) {
      setEmailAvailability({ status: "invalid", exists: false, message: "Digite um e-mail válido." });
      return;
    }

    setEmailAvailability({ status: "checking", exists: false });
    const timer = window.setTimeout(() => {
      void checkEmailAvailability(email).then(setEmailAvailability);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [draft.email]);

  useEffect(() => {
    const email = normalizeEmail(draft.recoveryEmail);
    if (!email) {
      setRecoveryEmailAvailability(emptyAvailability);
      return;
    }
    if (!validateEmail(email)) {
      setRecoveryEmailAvailability({ status: "invalid", exists: false, message: "Digite um e-mail válido." });
      return;
    }

    setRecoveryEmailAvailability({ status: "checking", exists: false });
    const timer = window.setTimeout(() => {
      void checkEmailAvailability(email).then((status) => {
        if (status.status === "exists") {
          setRecoveryEmailAvailability({
            ...status,
            message: "Pode usar como e-mail de recuperação.",
          });
          return;
        }
        setRecoveryEmailAvailability(status);
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [draft.recoveryEmail]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  return {
    step,
    setStep,
    draft,
    setDraft,
    emailAvailability,
    recoveryEmailAvailability,
    emailDialogOpen,
    setEmailDialogOpen,
    otp,
    setOtp,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    passwordStrength,
    biometricEnabled,
    setBiometricEnabled,
    biometricStatus,
    biometricAvailable: isBiometricStatusUsable(biometricStatus),
    loading,
    session,
    resendCooldown,
    sendVerificationEmail,
    verifyEmailCode,
    resendVerification,
    createPassword,
    completeSignup,
  };
}
