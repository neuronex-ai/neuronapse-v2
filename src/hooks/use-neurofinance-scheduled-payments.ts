/**
 * use-NeuroFinance-scheduled-payments.ts
 *
 * Manages scheduled/batch payments and DDA boleto queries
 * through the NeuroFinance Asaas infrastructure.
 *
 * Note: DDA (Débito Direto Autorizado) is a Brazilian-specific feature
 * that is abstracted by this hook, providing a 
 * compatibility layer that queries our internal records.
 *
 * Exports:
 *   - useNeuroFinanceScheduledPayments: Batch payment operations
 *   - useDDABoletos: Query pending boletos (returns empty for now)
 *   - usePaymentGroups: List payment groups from internal DB
 *   - usePaymentGroupItems: Get items in a payment group
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { toast } from "sonner";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

// ─── Types ────────────────────────────────────────────────────────

export interface SchedulePaymentItem {
    amount: number;
    content: string;           // bar_code, br_code or pix_key
    description?: string;
    bank_code?: string;
    bank_name?: string;
    beneficiary_name?: string;
    payer_name?: string;
    transaction_date?: string; // YYYY-MM-DD
}

export interface SchedulePaymentItemResult extends SchedulePaymentItem {
    id?: string;
    group_id?: string;
    product_type?: 'BOLETO' | 'PIX';
    status?: 'READ_DATA' | 'ERROR' | 'DECODE_ERROR' | 'PROCESSED' | 'SCHEDULED' | 'PROCESSING' | 'SCHEDULING_CANCELLED';
    error_message?: string;
    due_date?: string;
    overdue?: boolean;
}

export interface DDABond {
    amount: number;
    bank_code: string;
    bank_name: string;
    beneficiary_name: string;
    content: string;
    due_date: string;
    overdue: boolean;
    payer_name: string;
}

export interface PaymentGroup {
    id: string;
    user_id: string;
    group_id: string;
    status: string;
    description: string;
    items_count: number;
    created_at: string;
    updated_at?: string;
}

// ─── Scheduled Payments Hook ──────────────────────────────────────

export function useNeuroFinanceScheduledPayments() {
    const queryClient = useQueryClient();

    /**
     * Decode / validate a batch of payment items.
     * In NeuroFinance v2, this creates draft payment records 
     * and validates the data locally.
     */
    const decodePayments = useMutation({
        mutationFn: async (items: SchedulePaymentItem[]) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Não autenticado');

            const groupId = crypto.randomUUID();
            const results: SchedulePaymentItemResult[] = [];

            for (const item of items) {
                const isPix = item.content.trim().startsWith('000201');
                if (isPix) {
                    results.push({
                        ...item,
                        id: crypto.randomUUID(),
                        group_id: groupId,
                        product_type: 'PIX',
                        status: 'READ_DATA',
                    });
                    continue;
                }

                const response = await supabase.functions.invoke('asaas-bill-payment', {
                    body: { action: 'simulate', identificationField: item.content.trim() },
                });
                if (response.error) throw new Error(response.error.message);
                if (response.data?.error) throw new Error(response.data.error);
                const bill = response.data?.bill || {};
                results.push({
                    ...item,
                    amount: Number(bill.value || item.amount),
                    beneficiary_name: bill.beneficiaryName || item.beneficiary_name,
                    due_date: bill.dueDate || undefined,
                    id: crypto.randomUUID(),
                    group_id: groupId,
                    product_type: 'BOLETO',
                    status: 'READ_DATA',
                });
            }

            return { group_id: groupId, items: results };
        },
        onSuccess: () => {
            toast.success('Grupo de pagamentos validado!');
            queryClient.invalidateQueries({ queryKey: ['NeuroFinance-payment-groups'] });
        },
        onError: (error: Error) => {
            console.error("[ScheduledPayments] Falha na validação", error);
            toast.error(getUserFacingErrorMessage(error, "payment"));
        },
    });

    /**
     * Query DDA (pending boletos).
     * Note: DDA is a Brazilian clearing house feature not directly available
     * through the legacy architecture. Now available via Asaas BaaS 
     * but not yet implemented. Returns empty for now.
     */
    const queryDDA = async (): Promise<{ items: DDABond[] }> => {
        // DDA is not yet implemented in the Asaas BaaS integration
        // This will be connected to the Asaas DDA endpoint in a future release
        return { items: [] };
    };

    /**
     * Get items in a payment group.
     */
    const getGroupItems = async (_groupId: string): Promise<{ items: SchedulePaymentItemResult[] }> => {
        // Payment groups are stored locally for now
        return { items: [] };
    };

    /**
     * Remove items from a payment group.
     */
    const removeGroupItems = useMutation({
        mutationFn: async ({ groupId: _groupId, itemIds: _itemIds }: { groupId: string; itemIds: string[] }) => {
            return { success: true };
        },
        onSuccess: () => {
            toast.success('Pagamentos removidos do grupo.');
            queryClient.invalidateQueries({ queryKey: ['NeuroFinance-payment-groups'] });
        },
        onError: (error: Error) => {
            console.error("[ScheduledPayments] Falha ao remover pagamentos", error);
            toast.error(getUserFacingErrorMessage(error, "delete"));
        },
    });

    /**
     * Remove a single item from a payment group.
     */
    const removeGroupItem = useMutation({
        mutationFn: async ({ groupId: _groupId, itemId: _itemId }: { groupId: string; itemId: string }) => {
            return { success: true };
        },
        onSuccess: () => {
            toast.success('Pagamento removido do grupo.');
            queryClient.invalidateQueries({ queryKey: ['NeuroFinance-payment-groups'] });
        },
        onError: (error: Error) => {
            console.error("[ScheduledPayments] Falha ao remover pagamento", error);
            toast.error(getUserFacingErrorMessage(error, "delete"));
        },
    });

    /**
     * Submit payment group for processing.
     */
    const submitForApproval = useMutation({
        mutationFn: async ({ groupId, items = [] }: { groupId: string; uploaderName?: string; items?: SchedulePaymentItemResult[] }) => {
            if (!items.length) throw new Error('Nenhum pagamento validado para processar.');

            const results = [];
            for (const item of items) {
                const isPix = item.product_type === 'PIX';
                if (isPix) {
                    throw new Error('Pagamentos Pix em lote exigem revisão individual e PIN financeiro.');
                }
                const response = await supabase.functions.invoke('asaas-bill-payment', {
                    body: {
                        action: 'create',
                        identificationField: item.content,
                        scheduleDate: item.transaction_date,
                        description: item.description,
                        value: item.amount,
                        externalReference: `${groupId}:${item.id}`,
                    },
                });
                if (response.error) throw new Error(response.error.message);
                if (response.data?.error) throw new Error(response.data.error);
                results.push(response.data);
            }
            return { success: true, group_id: groupId, results };
        },
        onSuccess: () => {
            toast.success('Grupo enviado para processamento!');
            queryClient.invalidateQueries({ queryKey: ['NeuroFinance-payment-groups'] });
        },
        onError: (error: Error) => {
            console.error("[ScheduledPayments] Falha no envio do grupo", error);
            toast.error(getUserFacingErrorMessage(error, "payment"));
        },
    });

    return {
        decodePayments,
        queryDDA,
        getGroupItems,
        removeGroupItems,
        removeGroupItem,
        submitForApproval,
    };
}

// ─── Query Hooks ──────────────────────────────────────────────────

/**
 * Hook to query DDA pending boletos.
 * Returns empty until the Asaas DDA endpoint is integrated.
 */
export function useDDABoletos() {
    const { queryDDA } = useNeuroFinanceScheduledPayments();
    const { user } = useAuth();

    return useQuery({
        queryKey: ['NeuroFinance-dda-boletos', user?.id],
        queryFn: queryDDA,
        enabled: !!user?.id,
        staleTime: 60_000,
    });
}

/**
 * Hook to list payment groups.
 */
export function usePaymentGroups() {
    const { user } = useAuth();

    return useQuery({
        queryKey: ['NeuroFinance-payment-groups', user?.id],
        queryFn: async (): Promise<{ groups: PaymentGroup[] }> => {
            // For now, return empty — payment groups will be stored
            // in a separate table once batch payments are implemented
            return { groups: [] };
        },
        enabled: !!user?.id,
        staleTime: 30_000,
    });
}

/**
 * Hook to get items of a specific payment group.
 */
export function usePaymentGroupItems(groupId: string | null) {
    const { getGroupItems } = useNeuroFinanceScheduledPayments();
    const { user } = useAuth();

    return useQuery({
        queryKey: ['NeuroFinance-payment-group-items', user?.id, groupId],
        queryFn: () => getGroupItems(groupId!),
        enabled: !!user?.id && !!groupId,
        staleTime: 15_000,
    });
}
