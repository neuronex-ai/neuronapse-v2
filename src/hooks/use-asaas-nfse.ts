import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface IssueInvoiceParams {
  payment_id: string;
  payment_record_id?: string;
  service_description: string;
  amount: number;
  municipal_service_id?: string;
  municipal_service_code?: string;
  municipal_service_name?: string;
  taxes?: Record<string, unknown>;
}

export const useAsaasNfse = () => {
  const mutation = useMutation({
    mutationFn: async (params: IssueInvoiceParams) => {
      const { data, error } = await supabase.functions.invoke('asaas-invoices', {
        body: {
          action: 'create',
          payment: params.payment_id,
          localPaymentId: params.payment_record_id,
          authorize: true,
          serviceDescription: params.service_description,
          value: params.amount,
          effectiveDate: new Date().toISOString().slice(0, 10),
          municipalServiceId: params.municipal_service_id,
          municipalServiceCode: params.municipal_service_code,
          municipalServiceName: params.municipal_service_name,
          taxes: params.taxes,
        }
      });

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success('Solicitacao de NFS-e enviada ao NeuroFinance.');
    },
    onError: (error) => {
      toast.error(`Erro na emissao: ${error.message}`);
    }
  });

  return {
    issueInvoice: mutation.mutate,
    isIssuing: mutation.isPending
  };
};
