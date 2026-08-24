import { Button } from "@/components/ui/button";
import { Loader2, DollarSign, FileText, CreditCard, CheckCircle, Calendar as CalendarIcon, Clock } from "lucide-react";
import { usePatientPortalInvoices } from "@/hooks/use-patient-portal-invoices";
import { Invoice } from "@/types";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_ANON_KEY, edgeFunctionUrl } from "@/lib/supabase-config";

// NeuroFinance: payment sessions routed through create-payment Edge Function
const createPaymentSession = async (invoice: Invoice): Promise<{ url: string }> => {
  // If the invoice already has a payment URL, reuse it
  if (invoice.payment_url) {
    return { url: invoice.payment_url };
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");

  // Buscar dados reais do paciente do DB
  const { data: invoiceRecord } = await supabase.from('invoices').select('patient_id').eq('id', invoice.id).single();
  const { data: patient } = await supabase.from('patients').select('name, email, cpf').eq('id', invoiceRecord?.patient_id).single();

  // Try NeuroFinance checkout payment link
  try {
    const asaasResponse = await fetch(
      edgeFunctionUrl('asaas-create-payment'),
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          amount: Math.round(invoice.amount * 100), // Convert to cents
          description: invoice.description || 'Pagamento NeuroNex',
          invoice_id: invoice.id,
          patient_id: invoiceRecord?.patient_id,
          payment_methods: ['pix', 'card', 'boleto'],
          customer_name: patient?.name || 'Paciente NeuroNex',
          customer_email: patient?.email || undefined,
        }),
      }
    );

    if (asaasResponse.ok) {
      const paymentData = await asaasResponse.json();
      if (paymentData?.checkout_url) {
        const paymentUrl = paymentData.checkout_url;
        // Save the payment URL to the invoice for future reuse
        await supabase.from('invoices').update({ payment_url: paymentUrl }).eq('id', invoice.id);
        return { url: paymentUrl };
      }
    }
  } catch (e) {
    console.warn('[PatientBillingPanel] NeuroFinance payment creation failed:', e);
  }

  // Fallback: generate a local payment page
  const fallbackUrl = `${window.location.origin}/pagamento/${invoice.id}`;
  return { url: fallbackUrl };
};

const usePayInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPaymentSession,
    onSuccess: (data) => {
      if (data.url) {
        toast.success("Redirecionando para o pagamento...");
        window.open(data.url, '_blank');
      }
      queryClient.invalidateQueries({ queryKey: ['patientPortalInvoices'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro no pagamento: ${error.message}`);
    }
  });
};

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const InvoiceItem = ({ invoice }: { invoice: Invoice }) => {
  const { mutate: payInvoice, isPending } = usePayInvoice();

  const handlePay = () => {
    payInvoice(invoice);
  };

  const isOverdue = invoice.due_date && new Date(invoice.due_date + 'T23:59:59') < new Date();

  return (
    <div className={cn(
      "flex flex-col p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group",
      isOverdue
        ? "bg-rose-500/[0.03] border-rose-500/20"
        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10"
    )}>
      {isOverdue && <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 blur-[40px] rounded-full pointer-events-none" />}

      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">{invoice.description}</p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">#{invoice.invoice_number}</p>
          </div>
        </div>
        {isOverdue && (
          <div className="px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-[9px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="h-3 w-3" /> Atrasado
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Valor</span>
          <span className="text-lg font-bold text-white tracking-tight">{formatCurrency(invoice.amount)}</span>
        </div>

        <Button
          size="sm"
          className="gap-2 bg-white text-black hover:bg-white/90 rounded-xl h-10 px-5 font-bold text-xs uppercase tracking-wider shadow-lg shadow-white/5 transition-all active:scale-95"
          onClick={handlePay}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {isPending ? "..." : "Pagar Agora"}
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground/60 font-medium bg-black/20 w-fit px-2 py-1 rounded-md">
        <CalendarIcon className="h-3 w-3" />
        Vence em: {invoice.due_date ? new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}
      </div>
    </div>
  );
};

export const PatientBillingPanel = () => {
  const { data: invoices, isLoading, error } = usePatientPortalInvoices();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive text-sm bg-rose-500/5 rounded-xl mx-4">
        Erro ao carregar faturas.
      </div>
    );
  }

  const pendingInvoices = invoices?.filter(i => i.status === 'pending') || [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Pagamentos
        </h2>
        {pendingInvoices.length > 0 && (
          <span className="text-[10px] font-bold bg-rose-500/10 text-rose-400 px-2 py-1 rounded-md border border-rose-500/20 uppercase tracking-wide">
            {pendingInvoices.length} Pendente(s)
          </span>
        )}
      </div>

      <div className="space-y-4">
        {pendingInvoices.length > 0 ? (
          pendingInvoices.map(i => (
            <InvoiceItem key={i.id} invoice={i} />
          ))
        ) : (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-30 text-emerald-500" />
            <p className="text-sm text-emerald-400/80 font-medium">Tudo em dia!</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Você não possui faturas pendentes.</p>
          </div>
        )}
      </div>
    </div>
  );
};
