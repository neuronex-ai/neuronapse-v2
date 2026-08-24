import { supabase } from '@/integrations/supabase/client';
import { useCallback, useEffect, useState } from 'react';

export const getAccountAssurance = () => supabase.auth.mfa.getAuthenticatorAssuranceLevel();

export const useAccountAssurance = (userId?: string) => {
  const [loading, setLoading] = useState(Boolean(userId));
  const [requiresChallenge, setRequiresChallenge] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return setLoading(false);
    setLoading(true);
    try {
      const result = await getAccountAssurance();
      if (result.error) throw result.error;
      setRequiresChallenge(result.data.nextLevel === 'aal2' && result.data.currentLevel !== 'aal2');
    } catch (error) {
      console.error('[Account assurance]', error);
      setRequiresChallenge(false);
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { loading, requiresChallenge, refresh };
};
