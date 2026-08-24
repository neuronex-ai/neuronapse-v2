import { supabase } from '@/integrations/supabase/client';

export type TotpFactor = { id: string; status: string; friendly_name?: string };

export const listTotpFactors = async (): Promise<TotpFactor[]> => {
  const result = await supabase.auth.mfa.listFactors();
  if (result.error) throw result.error;
  return result.data.totp as TotpFactor[];
};

export const getVerifiedTotpFactor = async (): Promise<TotpFactor | null> => {
  const factors = await listTotpFactors();
  return factors.find((factor) => factor.status === 'verified') || null;
};

export const enrollTotpFactor = async () => {
  const listed = await supabase.auth.mfa.listFactors();
  if (listed.error) throw listed.error;
  const all = (((listed.data as any).all || []) as Array<{ id: string; factor_type: string; status: string }>);
  for (const factor of all.filter((item) => item.factor_type === 'totp' && item.status !== 'verified')) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const result = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'NeuroNex Authenticator',
    issuer: 'NeuroNex',
  });
  if (result.error) throw result.error;
  return result.data;
};

export const verifyTotpCode = async (factorId: string, code: string) => {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) throw challenge.error;
  const verification = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });
  if (verification.error) throw verification.error;
  return verification.data;
};

export const removeTotpFactor = async (factorId: string) => {
  const result = await supabase.auth.mfa.unenroll({ factorId });
  if (result.error) throw result.error;
};

export const getMfaAssurance = async () => {
  const result = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (result.error) throw result.error;
  return result.data;
};
