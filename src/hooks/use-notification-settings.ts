import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/SessionContextProvider';

export interface NotificationSettings {
  id: string;
  user_id: string;
  email_enabled: boolean;
  email_appointment_reminders: boolean;
  email_payment_confirmations: boolean;
  email_security_alerts: boolean;
  in_app_enabled: boolean;
  in_app_new_patients: boolean;
  in_app_overdue_invoices: boolean;
  in_app_system_updates: boolean;
  sms_enabled: boolean;
  sms_security_alerts: boolean;
  sms_appointments: boolean;
  push_enabled: boolean;
  updated_at?: string;
}

export const DEFAULT_NOTIFICATION_SETTINGS: Omit<NotificationSettings, 'id' | 'user_id'> = {
  email_enabled: true,
  email_appointment_reminders: true,
  email_payment_confirmations: true,
  email_security_alerts: true,
  in_app_enabled: true,
  in_app_new_patients: true,
  in_app_overdue_invoices: true,
  in_app_system_updates: true,
  // SMS and browser push remain disabled until their delivery infrastructure
  // is operational. Persisting a preference must not imply a working channel.
  sms_enabled: false,
  sms_security_alerts: false,
  sms_appointments: false,
  push_enabled: false,
};

const fetchNotificationSettings = async (userId: string): Promise<Partial<NotificationSettings>> => {
  const { data, error } = await supabase
    .from('user_notification_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(data || {}),
    user_id: userId,
  };
};

const upsertNotificationSettings = async (settings: Partial<NotificationSettings>, userId: string) => {
  const {
    id: _id,
    updated_at: _updatedAt,
    ...editableSettings
  } = settings;

  const { data, error } = await supabase
    .from('user_notification_settings')
    .upsert({
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...editableSettings,
      user_id: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as NotificationSettings;
};

export const useNotificationSettings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const queryKey = ['notificationSettings', userId] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => fetchNotificationSettings(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });

  const mutation = useMutation({
    mutationFn: (settings: Partial<NotificationSettings>) => {
      if (!userId) throw new Error('Usuário não autenticado');
      return upsertNotificationSettings(settings, userId);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      toast.success('Preferências de notificação salvas.');
      void queryClient.invalidateQueries({ queryKey: ['dashboardAlerts', userId] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    saveSettings: mutation.mutate,
    saveSettingsAsync: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
};
