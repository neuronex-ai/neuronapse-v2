"use client";

import { ArrowUpRight } from "lucide-react";
import { useMemo } from "react";

import { FinanceDataTable } from "@/components/financeiro/shared/FinanceDataTable";
import { sortStatementTransactions, type StatementSortOrder } from "@/components/financeiro/statement/statement-utils";
import { Button } from "@/components/ui/button";
import {
  financePresentationFromTransaction,
  type FinanceColumnHelpContext,
  type FinancePresentationRow,
} from "@/lib/finance-presentation";
import type { Transaction } from "@/types";

interface FinancialStatementProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onSelectTransaction?: (transaction: Transaction) => void;
  sortOrder?: StatementSortOrder;
  /** Mantido por compatibilidade; o extrato detalhado preserva uma única tabela. */
  groupByDate?: boolean;
  context?: FinanceColumnHelpContext;
  isFuture?: boolean;
  hideValues?: boolean;
}

export const FinancialStatement = ({
  transactions,
  isLoading,
  onSelectTransaction,
  sortOrder = "desc",
  context = "statement_realized",
  isFuture = false,
  hideValues = false,
}: FinancialStatementProps) => {
  const sortedTransactions = useMemo(
    () => sortStatementTransactions(transactions || [], sortOrder),
    [sortOrder, transactions],
  );
  const transactionById = useMemo(
    () => new Map(sortedTransactions.map((transaction) => [transaction.id, transaction])),
    [sortedTransactions],
  );
  const rows = useMemo(
    () => sortedTransactions.map((transaction) => financePresentationFromTransaction(transaction, { context, isFuture })),
    [context, isFuture, sortedTransactions],
  );

  const openTransaction = (row: FinancePresentationRow) => {
    const transaction = transactionById.get(row.sourceId || row.id);
    if (transaction) onSelectTransaction?.(transaction);
  };

  return (
    <FinanceDataTable
      rows={rows}
      context={context}
      isLoading={isLoading}
      maskValues={hideValues}
      emptyTitle="Nenhuma movimentação"
      emptyDescription="Os registros aparecerão aqui conforme forem realizados ou previstos."
      renderActions={(row) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto h-11 w-11 rounded-xl"
          onClick={() => openTransaction(row)}
          aria-label={`Abrir detalhes de ${row.description}`}
        >
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    />
  );
};
