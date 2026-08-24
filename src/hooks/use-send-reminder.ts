import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SendReminderParams {
  appointmentId: string;
  patientEmail: string;
  patientName: string;
  startTime: string;
  endTime: string;
  type: string;
  meetLink: string | null;
  location: string | null;
}

export const useSendReminder = () => {
  return useMutation({
    mutationFn: async (params: SendReminderParams) => {
      const { data, error } = await supabase.functions.invoke('send-reminder-email', {
        body: {
          ...params,
          origin: window.location.origin
        }
      });

      if (error) throw error;
      return data;
    },
  });
};