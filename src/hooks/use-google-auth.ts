import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { getUserFacingErrorMessage } from '@/lib/user-facing-error';
import { edgeFunctionUrl } from '@/lib/supabase-config';

// URL da Edge Function para iniciar o fluxo OAuth
const GOOGLE_AUTH_INIT_URL = edgeFunctionUrl("google-auth-init");
const GOOGLE_AUTH_STATUS_URL = edgeFunctionUrl("google-auth-status");
const SPREADSHEET_ID_KEY = 'neuro_nex_spreadsheet_id';

export const useGoogleAuth = () => {
  const { session, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionEmail, setConnectionEmail] = useState<string | null>(null);

  const checkConnectionStatus = useCallback(async (retries = 3) => {
    if (!user) {
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Use service role via edge function if available, otherwise try direct query
    try {
      // Try fetching via edge function first (bypasses RLS issues)
      const response = await fetch(
        GOOGLE_AUTH_STATUS_URL,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.connected);
        setConnectionEmail(data.email || null);
        setIsLoading(false);
        return;
      }
    } catch (e) {
      console.log("Edge function status check failed, falling back to direct query");
    }

    // Fallback: Direct query (may fail due to RLS)
    const { data, error } = await supabase
      .from('user_google_tokens')
      .select('id, access_token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error("Error checking Google connection:", error);

      // Retry with delay if we have retries left
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return checkConnectionStatus(retries - 1);
      }

      setIsConnected(false);
    } else if (data && data.access_token) {
      setIsConnected(true);
    } else {
      setIsConnected(false);
    }

    setIsLoading(false);
  }, [user, session]);

  // Check connection on mount and when user changes
  useEffect(() => {
    checkConnectionStatus();
  }, [checkConnectionStatus]);

  // Also check when URL has success params (after OAuth redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const service = urlParams.get('service');

    if (status === 'success' && service === 'google') {
      // Small delay to ensure tokens are saved
      setTimeout(() => {
        checkConnectionStatus();
        toast.success("Google Workspace conectado com sucesso! 🎉");
      }, 500);

      // Clean up URL params
      window.history.replaceState({}, '', window.location.pathname);
    } else if (status === 'error' && service === 'google') {
      const message = urlParams.get('message');
      console.error('[useGoogleAuth] Retorno OAuth com erro', message);
      toast.error(getUserFacingErrorMessage(message, 'sync'));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [checkConnectionStatus]);

  const connectGoogle = useCallback(async (options?: { returnTo?: string }) => {
    if (!session) {
      toast.error("Usuário não autenticado. Faça login primeiro.");
      return;
    }

    setIsLoading(true);

    try {
      const url = new URL(GOOGLE_AUTH_INIT_URL);
      if (options?.returnTo) url.searchParams.set('returnTo', options.returnTo);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Falha ao iniciar autenticação do Google.");
      }

      const { authUrl } = await response.json();

      // Redirect to Google OAuth
      window.location.href = authUrl;

    } catch (error: any) {
      console.error("Google Auth Init Error:", error);
      toast.error(getUserFacingErrorMessage(error, 'sync'));
      setIsLoading(false);
    }
  }, [session]);

  const disconnectGoogle = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);

    const { error } = await supabase
      .from('user_google_tokens')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('[useGoogleAuth] Falha ao desconectar', error);
      toast.error(getUserFacingErrorMessage(error, 'delete'));
      setIsLoading(false);
    } else {
      localStorage.removeItem(SPREADSHEET_ID_KEY);
      toast.success("Google Workspace desconectado com sucesso.");
      setIsConnected(false);
      setConnectionEmail(null);
      setIsLoading(false);
    }
  }, [user]);

  return {
    isConnected,
    isLoading,
    connectionEmail,
    connectGoogle,
    disconnectGoogle,
    checkConnectionStatus,
  };
};
