import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export interface FinancialMetrics {
  currentMonthRevenue: number;
  currentMonthExpenses: number;
  netProfit: number;
  projectedRevenue: number;
  pendingInvoices: number;
  projectedExpenses?: number;
  projectedNetProfit?: number;
}

const fetchFinancialMetrics = async (userId: string): Promise<FinancialMetrics> => {
  const now = new Date();
  const startDate = format(startOfMonth(now), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(now), 'yyyy-MM-dd');

  // Chamada RPC otimizada
  const { data, error } = await supabase
    .rpc('get_financial_metrics', {
      p_user_id: userId,
      p_start_date: startDate,
      p_end_date: endDate
    });

  if (error) {
    console.warn('Métricas financeiras indisponíveis:', error.message);
    // Return defaults instead of throwing — table/RPC may not exist yet
    return {
      currentMonthRevenue: 0,
      currentMonthExpenses: 0,
      netProfit: 0,
      projectedRevenue: 0,
      pendingInvoices: 0,
      projectedExpenses: 0,
      projectedNetProfit: 0,
    };
  }

  // Garantir valores padrão caso o retorno seja nulo
  return {
    currentMonthRevenue: data?.currentMonthRevenue || 0,
    currentMonthExpenses: data?.currentMonthExpenses || 0,
    netProfit: data?.netProfit || 0,
    projectedRevenue: data?.projectedRevenue || 0,
    pendingInvoices: data?.pendingInvoices || 0,
    projectedExpenses: data?.currentMonthExpenses || 0, // Simplificação para UI
    projectedNetProfit: (data?.projectedRevenue || 0) - (data?.currentMonthExpenses || 0)
  };
};

export const useFinancialMetrics = () => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<FinancialMetrics, Error>({
    queryKey: ['financialMetrics', userId],
    queryFn: () => fetchFinancialMetrics(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
};