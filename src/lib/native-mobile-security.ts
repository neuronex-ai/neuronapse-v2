import type { Session } from "@supabase/supabase-js";

type BridgeResult<T = unknown> = T | Promise<T>;

type NativeBridge = {
  getBiometricStatus?: (payload?: unknown) => BridgeResult<unknown>;
  authenticateBiometric?: (payload?: unknown) => BridgeResult<unknown>;
  secureStorageGet?: (payload: unknown) => BridgeResult<unknown>;
  secureStorageSet?: (payload: unknown) => BridgeResult<unknown>;
  secureStorageRemove?: (payload: unknown) => BridgeResult<unknown>;
  scanCode?: (payload: unknown) => BridgeResult<unknown>;
};

type NativeWindow = Window & {
  NeuroNexAndroid?: NativeBridge;
  Capacitor?: {
    Plugins?: Record<string, NativeBridge>;
    getPlatform?: () => string;
    isNativePlatform?: () => boolean;
  };
};

function isLikelyMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export type BiometricStatus = {
  available: boolean;
  enrolled: boolean;
  supported: boolean;
  native: boolean;
  biometryType?: string | null;
  reason?: string | null;
};

export type StoredBiometricAccount = {
  userId: string;
  email?: string | null;
  enabledAt: string;
};

export type BiometricPreference = "enabled" | "disabled" | "unset";

const BIOMETRIC_ACCOUNT_KEY = "neuronex.biometric.account.v1";
const BIOMETRIC_PREFERENCE_PREFIX = "neuronex.biometric.preference.v1";
const BIOMETRIC_ENABLED_PREFIX = "neuronex.biometric.enabled.v1";
const BIOMETRIC_SESSION_PREFIX = "neuronex.biometric.session.v1";
const WEBAUTHN_CREDENTIAL_PREFIX = "neuronex.biometric.webauthn.v1";
const FINANCIAL_PIN_PREFIX = "neuronex.financial-pin.v1";
const SUPABASE_AUTH_TOKEN_SUFFIX = "-auth-token";

let authVaultUnlocked = false;

function getNativeBridge(): NativeBridge | null {
  if (typeof window === "undefined") return null;
  const nativeWindow = window as NativeWindow;
  return (
    nativeWindow.Capacitor?.Plugins?.NeuroNexSecure ||
    nativeWindow.Capacitor?.Plugins?.NeuroNexNative ||
    nativeWindow.NeuroNexAndroid ||
    null
  );
}

function hasSecureStorageBridge() {
  const bridge = getNativeBridge();
  return Boolean(
    bridge?.secureStorageGet &&
      bridge.secureStorageSet &&
      bridge.secureStorageRemove,
  );
}

function canAttemptWebAuthnPlatform() {
  return Boolean(
    typeof window !== "undefined" &&
      window.isSecureContext &&
      window.PublicKeyCredential &&
      navigator.credentials &&
      window.crypto?.getRandomValues,
  );
}

async function isWebAuthnPlatformAvailable() {
  if (!canAttemptWebAuthnPlatform()) return false;
  try {
    return Boolean(
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.(),
    );
  } catch {
    return false;
  }
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToArrayBuffer(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function createWebAuthnChallenge() {
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  return challenge;
}

function createWebAuthnUserHandle(userId: string) {
  return new TextEncoder().encode(userId).slice(0, 64);
}

function getStoredWebAuthnCredentialId(userId?: string | null) {
  if (!userId) return null;
  return localGet(keyWithUser(WEBAUTHN_CREDENTIAL_PREFIX, userId));
}

async function normalizeNativeResult<T>(result: unknown): Promise<T | null> {
  const resolved = await result;
  if (typeof resolved === "string") {
    try {
      return JSON.parse(resolved) as T;
    } catch {
      return resolved as T;
    }
  }
  return (resolved ?? null) as T | null;
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function localGet(key: string) {
  if (!canUseLocalStorage()) return null;
  return window.localStorage.getItem(key);
}

function localSet(key: string, value: string) {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(key, value);
}

function localRemove(key: string) {
  if (!canUseLocalStorage()) return;
  window.localStorage.removeItem(key);
}

function keyWithUser(prefix: string, userId: string) {
  return `${prefix}:${userId}`;
}

function isSupabaseAuthTokenKey(key: string) {
  return key.endsWith(SUPABASE_AUTH_TOKEN_SUFFIX);
}

function readSessionFromAuthStorageValue(value: string) {
  try {
    const parsed = JSON.parse(value) as Partial<Session> & {
      currentSession?: Partial<Session>;
    };
    const session = parsed.currentSession || parsed;
    if (!session.access_token || !session.refresh_token) return null;
    return session;
  } catch {
    return null;
  }
}

async function syncBiometricSessionFromAuthValue(value: string) {
  const account = getStoredBiometricAccount();
  if (!account || !isBiometricEnabledForUser(account.userId)) return;

  const session = readSessionFromAuthStorageValue(value);
  if (!session) return;

  await secureSet(
    keyWithUser(BIOMETRIC_SESSION_PREFIX, account.userId),
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
    }),
    { requireAuthentication: true },
  );
}

async function clearBiometricSessionAfterSignOut() {
  const account = getStoredBiometricAccount();
  if (!account) return;

  await secureRemove(keyWithUser(BIOMETRIC_SESSION_PREFIX, account.userId));
  await secureRemove(keyWithUser(FINANCIAL_PIN_PREFIX, account.userId));
  localRemove(keyWithUser(BIOMETRIC_ENABLED_PREFIX, account.userId));
  localRemove(BIOMETRIC_ACCOUNT_KEY);
}

async function secureGet(key: string, options?: Record<string, unknown>) {
  const bridge = getNativeBridge();
  if (bridge?.secureStorageGet) {
    const result = await normalizeNativeResult<{ value?: string | null } | string>(
      bridge.secureStorageGet({ key, ...options }),
    );
    if (typeof result === "string") return result;
    return result?.value ?? null;
  }
  return localGet(key);
}

async function secureSet(key: string, value: string, options?: Record<string, unknown>) {
  const bridge = getNativeBridge();
  if (bridge?.secureStorageSet) {
    await bridge.secureStorageSet({ key, value, ...options });
    return;
  }
  localSet(key, value);
}

async function secureSetAfterStrongAuth(key: string, value: string) {
  try {
    await secureSet(key, value, { requireAuthentication: true });
  } catch {
    await secureSet(key, value);
  }
}

async function secureGetAfterStrongAuth(key: string) {
  try {
    return await secureGet(key, { requireAuthentication: true });
  } catch {
    return secureGet(key);
  }
}

async function secureRemove(key: string) {
  const bridge = getNativeBridge();
  if (bridge?.secureStorageRemove) {
    await bridge.secureStorageRemove({ key });
    return;
  }
  localRemove(key);
}

export function hasNativeSecureBridge() {
  const bridge = getNativeBridge();
  return Boolean(
    (hasSecureStorageBridge() && (bridge?.getBiometricStatus || bridge?.authenticateBiometric)) ||
      canAttemptWebAuthnPlatform(),
  );
}

export function canAttemptNativeBiometrics() {
  const bridge = getNativeBridge();
  return Boolean(
    bridge?.getBiometricStatus ||
      bridge?.authenticateBiometric ||
      canAttemptWebAuthnPlatform() ||
      isLikelyMobileDevice(),
  );
}

export function isBiometricStatusUsable(status?: BiometricStatus | null) {
  return Boolean(
    status &&
      (status.native || status.biometryType === "platform") &&
      status.supported !== false &&
      (status.available || status.enrolled || status.reason === null),
  );
}

export function hasNativeCodeScanner() {
  return Boolean(getNativeBridge()?.scanCode);
}

export async function getBiometricStatus(): Promise<BiometricStatus> {
  const bridge = getNativeBridge();

  if (bridge?.getBiometricStatus) {
    try {
      const result = await normalizeNativeResult<Record<string, unknown>>(
        bridge.getBiometricStatus({ allowDeviceCredential: true }),
      );
      const available = Boolean(result?.available ?? result?.canAuthenticate ?? result?.success);
      const enrolled = Boolean(
        result?.enrolled ??
          result?.hasEnrolledBiometrics ??
          result?.hasEnrolled ??
          available,
      );
      return {
        available,
        enrolled,
        supported: Boolean(result?.supported ?? available),
        native: true,
        biometryType: String(result?.biometryType || result?.type || "biometric"),
        reason: typeof result?.reason === "string" ? result.reason : null,
      };
    } catch (error) {
      return {
        available: false,
        enrolled: false,
        supported: true,
        native: true,
        reason:
          error instanceof Error
            ? error.message
            : "Nao foi possivel verificar a biometria deste aparelho.",
      };
    }
  }

  if (bridge?.authenticateBiometric) {
    return {
      available: true,
      enrolled: true,
      supported: true,
      native: true,
      biometryType: "biometric",
      reason: null,
    };
  }

  if (await isWebAuthnPlatformAvailable()) {
    return {
      available: true,
      enrolled: true,
      supported: true,
      native: false,
      biometryType: "platform",
      reason: null,
    };
  }

  return {
    available: false,
    enrolled: false,
    supported: canAttemptWebAuthnPlatform(),
    native: false,
    biometryType: null,
    reason: canAttemptWebAuthnPlatform()
      ? "Configure biometria, senha ou bloqueio seguro no aparelho."
      : "Biometria indisponivel neste ambiente. Use login normal.",
  };
}

async function registerWebAuthnCredential(params: {
  userId: string;
  email?: string | null;
}) {
  if (!canAttemptWebAuthnPlatform()) {
    throw new Error("Autenticador de plataforma indisponivel neste aparelho.");
  }

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: createWebAuthnChallenge(),
      rp: { name: "NeuroNex" },
      user: {
        id: createWebAuthnUserHandle(params.userId),
        name: params.email || params.userId,
        displayName: params.email || "NeuroNex",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!credential?.rawId) {
    throw new Error("Biometria nao confirmada. Use login normal.");
  }

  localSet(
    keyWithUser(WEBAUTHN_CREDENTIAL_PREFIX, params.userId),
    arrayBufferToBase64Url(credential.rawId),
  );

  return true;
}

async function authenticateWithWebAuthn(params: {
  reason: string;
  userId?: string | null;
  email?: string | null;
  allowRegistration?: boolean;
}) {
  if (!canAttemptWebAuthnPlatform()) {
    throw new Error("Biometria de plataforma indisponivel neste ambiente.");
  }

  if (!params.userId) {
    throw new Error("Conta biometrica nao encontrada neste aparelho.");
  }

  const storedCredentialId = getStoredWebAuthnCredentialId(params.userId);
  if (!storedCredentialId && params.allowRegistration) {
    return registerWebAuthnCredential({
      userId: params.userId,
      email: params.email,
    });
  }

  if (!storedCredentialId) {
    throw new Error("Biometria ainda nao esta vinculada neste aparelho.");
  }

  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: createWebAuthnChallenge(),
      allowCredentials: [
        {
          type: "public-key",
          id: base64UrlToArrayBuffer(storedCredentialId),
        },
      ],
      userVerification: "required",
      timeout: 60000,
    },
  });

  if (!credential) {
    throw new Error("Biometria nao confirmada. Use senha ou PIN.");
  }

  return true;
}

export async function authenticateWithBiometrics(
  reason: string,
  options?: {
    userId?: string | null;
    email?: string | null;
    allowRegistration?: boolean;
  },
) {
  const bridge = getNativeBridge();
  if (bridge?.authenticateBiometric) {
    const result = await normalizeNativeResult<Record<string, unknown>>(
      bridge.authenticateBiometric({
        title: "NeuroNex",
        subtitle: reason,
        description: "Confirme sua identidade com biometria ou bloqueio do aparelho.",
        negativeButtonText: "Usar senha",
        allowDeviceCredential: true,
        confirmationRequired: true,
      }),
    );

    if (result && result.success === false) {
      throw new Error(String(result.reason || result.error || "Biometria nao confirmada."));
    }

    return true;
  }

  return authenticateWithWebAuthn({
    reason,
    userId: options?.userId,
    email: options?.email,
    allowRegistration: options?.allowRegistration,
  });
}

export function getStoredBiometricAccount(): StoredBiometricAccount | null {
  const raw = localGet(BIOMETRIC_ACCOUNT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredBiometricAccount;
    return parsed?.userId ? parsed : null;
  } catch {
    return null;
  }
}

export function isBiometricEnabledForUser(userId?: string | null) {
  if (!userId) return false;
  return localGet(keyWithUser(BIOMETRIC_ENABLED_PREFIX, userId)) === "true";
}

export function getBiometricPreferenceForUser(userId?: string | null): BiometricPreference {
  if (!userId) return "unset";
  const value = localGet(keyWithUser(BIOMETRIC_PREFERENCE_PREFIX, userId));
  return value === "enabled" || value === "disabled" ? value : "unset";
}

function setBiometricPreferenceForUser(userId: string, preference: Exclude<BiometricPreference, "unset">) {
  localSet(keyWithUser(BIOMETRIC_PREFERENCE_PREFIX, userId), preference);
}

export async function enableBiometricSignIn(params: {
  userId: string;
  email?: string | null;
  session: Session;
}) {
  const status = await getBiometricStatus();
  if (!isBiometricStatusUsable(status)) {
    throw new Error(
      status.reason ||
        "Este aparelho ainda nao tem biometria ou bloqueio seguro configurado.",
    );
  }

  await authenticateWithBiometrics("Ativar Entrar com biometria", {
    userId: params.userId,
    email: params.email,
    allowRegistration: true,
  });

  const account: StoredBiometricAccount = {
    userId: params.userId,
    email: params.email,
    enabledAt: new Date().toISOString(),
  };

  localSet(BIOMETRIC_ACCOUNT_KEY, JSON.stringify(account));
  localSet(keyWithUser(BIOMETRIC_ENABLED_PREFIX, params.userId), "true");
  setBiometricPreferenceForUser(params.userId, "enabled");

  await secureSetAfterStrongAuth(
    keyWithUser(BIOMETRIC_SESSION_PREFIX, params.userId),
    JSON.stringify({
      access_token: params.session.access_token,
      refresh_token: params.session.refresh_token,
      expires_at: params.session.expires_at,
      expires_in: params.session.expires_in,
      token_type: params.session.token_type,
    }),
  );

  authVaultUnlocked = true;
}

export async function disableBiometricSignIn(userId: string) {
  await secureRemove(keyWithUser(BIOMETRIC_SESSION_PREFIX, userId));
  await secureRemove(keyWithUser(FINANCIAL_PIN_PREFIX, userId));
  localRemove(keyWithUser(BIOMETRIC_ENABLED_PREFIX, userId));
  setBiometricPreferenceForUser(userId, "disabled");

  const account = getStoredBiometricAccount();
  if (account?.userId === userId) {
    localRemove(BIOMETRIC_ACCOUNT_KEY);
  }
}

export async function restoreBiometricSession() {
  const account = getStoredBiometricAccount();
  if (!account || !isBiometricEnabledForUser(account.userId)) {
    throw new Error("Biometria nao esta ativa neste dispositivo.");
  }

  const status = await getBiometricStatus();
  if (!isBiometricStatusUsable(status)) {
    throw new Error(
      status.reason ||
        "Biometria indisponivel. Entre com e-mail e senha para continuar.",
    );
  }

  await authenticateWithBiometrics("Entrar no NeuroNex", {
    userId: account.userId,
    email: account.email,
  });
  authVaultUnlocked = true;

  const raw = await secureGet(keyWithUser(BIOMETRIC_SESSION_PREFIX, account.userId));
  if (!raw) {
    throw new Error("Sessao biometrica nao encontrada. Entre com e-mail e senha.");
  }

  return {
    account,
    session: JSON.parse(raw) as Pick<
      Session,
      "access_token" | "refresh_token" | "expires_at" | "expires_in" | "token_type"
    >,
  };
}

export async function canUseBiometricTransaction(userId?: string | null) {
  if (!userId || !isBiometricEnabledForUser(userId)) return false;
  const status = await getBiometricStatus();
  return isBiometricStatusUsable(status);
}

export async function getFinancialPinWithBiometrics(params: {
  userId: string;
  reason: string;
}) {
  if (!(await canUseBiometricTransaction(params.userId))) {
    throw new Error("Biometria nao esta ativa para transacoes neste dispositivo.");
  }

  await authenticateWithBiometrics(params.reason, {
    userId: params.userId,
  });
  const raw = await secureGetAfterStrongAuth(keyWithUser(FINANCIAL_PIN_PREFIX, params.userId));
  if (!raw) {
    throw new Error("Digite o PIN uma vez para liberar o uso com biometria.");
  }
  return raw;
}

export async function rememberFinancialPinForBiometrics(userId: string, pin: string) {
  if (!/^\d{6}$/.test(pin) || !(await canUseBiometricTransaction(userId))) return;
  await secureSetAfterStrongAuth(keyWithUser(FINANCIAL_PIN_PREFIX, userId), pin);
}

export async function forgetFinancialPinForBiometrics(userId: string) {
  await secureRemove(keyWithUser(FINANCIAL_PIN_PREFIX, userId));
}

export async function scanCodeWithNative(params: {
  mode: "pix" | "boleto";
}): Promise<string | null> {
  const bridge = getNativeBridge();
  if (!bridge?.scanCode) return null;

  const result = await normalizeNativeResult<Record<string, unknown> | string>(
    bridge.scanCode({
      formats:
        params.mode === "pix"
          ? ["QR_CODE"]
          : ["ITF", "CODE_128", "CODABAR", "EAN_13", "EAN_8"],
      prompt:
        params.mode === "pix"
          ? "Aponte a camera para o QR Code Pix."
          : "Vire o celular na horizontal e enquadre as barras do boleto de ponta a ponta.",
      useMlKit: true,
      useCameraX: true,
      orientation: params.mode === "boleto" ? "landscape" : "portrait",
      tryHarder: params.mode === "boleto",
    }),
  );

  if (typeof result === "string") return result;
  if (typeof result?.value === "string") return result.value;
  if (typeof result?.rawValue === "string") return result.rawValue;
  return null;
}

export function createSupabaseAuthStorage() {
  return {
    getItem: async (key: string) => {
      if (
        isSupabaseAuthTokenKey(key) &&
        getStoredBiometricAccount() &&
        !authVaultUnlocked
      ) {
        return null;
      }
      return secureGet(key);
    },
    setItem: async (key: string, value: string) => {
      await secureSet(key, value);
      if (isSupabaseAuthTokenKey(key)) {
        await syncBiometricSessionFromAuthValue(value).catch(() => undefined);
      }
    },
    removeItem: async (key: string) => {
      await secureRemove(key);
      if (isSupabaseAuthTokenKey(key)) {
        await clearBiometricSessionAfterSignOut().catch(() => undefined);
      }
    },
  };
}
