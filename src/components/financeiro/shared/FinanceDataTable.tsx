import { AlertCircle, CheckCircle2, Clock3, Info, Loader2, MoreHorizontal, ShieldAlert, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FINANCE_AVAILABILITY_LABELS,
  FINANCE_COLUMN_ORDER,
  FINANCE_METHOD_LABELS,
  FINANCE_ORIGIN_LABELS,
  FINANCE_STATUS_META,
  getFinanceColumnHelp,
  type FinanceColumnHelpContext,
  type FinanceColumnId,
  type FinancePresentationRow,
  type FinanceStatusCode,
} from "@/lib/finance-presentation";
import { cn } from "@/lib/utils";

const COLUMN_LABELS: Record<FinanceColumnId, string> = {
  patient: "Paciente",
  description: "Descrição",
  origin: "Origem",
  method: "Método",
  competence: "Competência",
  status: "Status",
  gross: "Valor",
  net: "Líquido",
  actions: "Ações",
};

const STATUS_TONES: Record<FinanceStatusCode, string> = {
  planned: "border-border/55 bg-muted/45 text-muted-foreground",
  pending: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  overdue: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  processing: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  confirmed: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  cancelled: "border-border/55 bg-muted/45 text-muted-foreground",
  reversal_pending: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  reversed: "border-border/55 bg-muted/45 text-foreground/72",
  refund_pending: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  refunded: "border-border/55 bg-muted/45 text-foreground/72",
  disputed: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  failed: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.abs(value || 0));

function ColumnHelpHeader({ column, context }: { column: FinanceColumnId; context: FinanceColumnHelpContext }) {
  const help = getFinanceColumnHelp(column, context);
  return (
    <div className={cn("flex items-center gap-0.5", ["gross", "net", "actions"].includes(column) && "justify-end")}>
      <span>{COLUMN_LABELS[column]}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group -my-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground/70 outline-none transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={`Entender a coluna ${COLUMN_LABELS[column]}`}
          >
            <Info className="h-3.5 w-3.5 transition-transform group-hover:scale-105" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align={column === "actions" ? "end" : "start"} sideOffset={8} className="finance-panel w-[min(340px,calc(100vw-32px))] rounded-[20px] border-border/55 p-5 shadow-2xl">
          <p className="text-sm font-black tracking-tight text-foreground">{help.title}</p>
          <p className="mt-2 text-xs font-medium leading-5 text-muted-foreground">{help.body}</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function FinanceStatusBadge({ status }: { status: FinanceStatusCode }) {
  const meta = FINANCE_STATUS_META[status];
  const Icon = status === "confirmed"
    ? CheckCircle2
    : status === "pending" || status === "processing" || status.endsWith("_pending")
      ? Clock3
      : ["overdue", "failed", "disputed"].includes(status)
        ? ShieldAlert
        : ["cancelled", "reversed", "refunded"].includes(status)
          ? XCircle
          : AlertCircle;
  return (
    <span className={cn("inline-flex max-w-[176px] items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.1em]", STATUS_TONES[status])} title={meta.description}>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", status === "processing" && "motion-safe:animate-pulse")} aria-hidden="true" />
      <span className="leading-4">{meta.label}</span>
    </span>
  );
}

export interface FinanceDataTableProps {
  rows: FinancePresentationRow[];
  context?: FinanceColumnHelpContext;
  isLoading?: boolean;
  error?: unknown;
  emptyTitle?: string;
  emptyDescription?: string;
  selectedIds?: Set<string>;
  onToggleRow?: (id: string, checked: boolean) => void;
  onToggleAll?: (checked: boolean) => void;
  renderActions?: (row: FinancePresentationRow) => ReactNode;
  maskValues?: boolean;
  className?: string;
}

export function FinanceDataTable({
  rows,
  context = "generic",
  isLoading,
  error,
  emptyTitle = "Nenhuma operação encontrada",
  emptyDescription = "Ajuste os filtros ou registre uma nova operação para começar.",
  selectedIds,
  onToggleRow,
  onToggleAll,
  renderActions,
  maskValues = false,
  className,
}: FinanceDataTableProps) {
  const selectable = Boolean(selectedIds && onToggleRow);
  const allSelected = Boolean(rows.length && selectedIds && rows.every((row) => selectedIds.has(row.id)));
  const columnCount = FINANCE_COLUMN_ORDER.length + (selectable ? 1 : 0);

  return (
    <div className={cn("overflow-hidden rounded-[24px] border border-border/55 bg-card/78 shadow-[0_16px_48px_-42px_hsl(var(--foreground)/0.3)]", className)}>
      <div className="max-w-full overflow-x-auto overscroll-x-contain">
        <Table className="min-w-[1180px] table-fixed">
          <TableHeader className="sticky top-0 z-20 bg-card/95 backdrop-blur-xl supports-[backdrop-filter]:bg-card/88">
            <TableRow className="border-border/55 hover:bg-transparent">
              {selectable ? (
                <TableHead className="sticky left-0 z-30 w-14 bg-card/95 px-4">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => onToggleAll?.(checked === true)}
                    aria-label="Selecionar todas as operações visíveis"
                  />
                </TableHead>
              ) : null}
              {FINANCE_COLUMN_ORDER.map((column) => (
                <TableHead
                  key={column}
                  className={cn(
                    "h-14 px-4 text-[10px] font-black uppercase tracking-[0.13em] text-muted-foreground",
                    column === "patient" && "sticky z-20 w-[170px] bg-card/95",
                    column === "patient" && (selectable ? "left-14" : "left-0"),
                    column === "description" && "w-[250px]",
                    column === "origin" && "w-[126px]",
                    column === "method" && "w-[130px]",
                    column === "competence" && "w-[136px]",
                    column === "status" && "w-[176px]",
                    column === "gross" && "w-[126px] text-right",
                    column === "net" && "w-[140px] text-right",
                    column === "actions" && "sticky right-0 z-20 w-[104px] bg-card/95 text-right",
                  )}
                >
                  <ColumnHelpHeader column={column} context={context} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    <span className="text-sm font-semibold">Carregando operações…</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="h-48 text-center">
                  <div className="mx-auto max-w-sm">
                    <AlertCircle className="mx-auto h-6 w-6 text-rose-500" aria-hidden="true" />
                    <p className="mt-3 text-sm font-black text-foreground">Não foi possível carregar as operações</p>
                    <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">Tente novamente. Seus filtros e registros não foram alterados.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="h-52 text-center">
                  <div className="mx-auto max-w-sm">
                    <p className="text-sm font-black text-foreground">{emptyTitle}</p>
                    <p className="mt-1.5 text-xs font-medium leading-5 text-muted-foreground">{emptyDescription}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.map((row) => {
              const selected = selectedIds?.has(row.id) || false;
              const signedGross = row.direction === "expense" ? -row.grossAmount : row.grossAmount;
              const signedNet = row.netAmount == null ? null : row.direction === "expense" ? -row.netAmount : row.netAmount;
              return (
                <TableRow key={row.id} data-state={selected ? "selected" : undefined} className="group border-border/45 transition-colors hover:bg-muted/28 data-[state=selected]:bg-muted/45">
                  {selectable ? (
                    <TableCell className="sticky left-0 z-10 bg-card/95 px-4 group-hover:bg-muted/95">
                      <Checkbox checked={selected} onCheckedChange={(checked) => onToggleRow?.(row.id, checked === true)} aria-label={`Selecionar ${row.description}`} />
                    </TableCell>
                  ) : null}
                  <TableCell className={cn("sticky z-10 bg-card/95 px-4 py-4 group-hover:bg-muted/95", selectable ? "left-14" : "left-0")}>
                    <p className="truncate text-sm font-bold text-foreground" title={row.patientName}>{row.patientName}</p>
                    <p className="mt-1 text-[10px] font-semibold text-muted-foreground">{row.patientId ? "Paciente vinculado" : "Sem vínculo clínico"}</p>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <p className="line-clamp-2 text-sm font-bold leading-5 text-foreground" title={row.description}>{row.description}</p>
                    {row.typeLabel ? <p className="mt-1 text-[10px] font-black uppercase tracking-[0.11em] text-muted-foreground">{row.typeLabel}</p> : null}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-xs font-bold text-foreground/82">{FINANCE_ORIGIN_LABELS[row.origin]}</TableCell>
                  <TableCell className="px-4 py-4 text-xs font-bold text-foreground/82">{FINANCE_METHOD_LABELS[row.method]}</TableCell>
                  <TableCell className="px-4 py-4 text-xs font-semibold tabular-nums text-muted-foreground">{row.competenceLabel}</TableCell>
                  <TableCell className="px-4 py-4"><FinanceStatusBadge status={row.status} /></TableCell>
                  <TableCell className={cn("px-4 py-4 text-right text-sm font-black tabular-nums", row.direction === "expense" && "text-rose-600 dark:text-rose-300")}>
                    {maskValues ? "R$ ••••••" : <>{signedGross < 0 ? "−" : ""}{money(signedGross)}</>}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right">
                    <p className="text-sm font-black tabular-nums text-foreground">
                      {maskValues
                        ? "R$ ••••••"
                        : row.netApplicability === "not_applicable"
                          ? "—"
                          : signedNet == null
                            ? "A calcular"
                            : `${signedNet < 0 ? "−" : ""}${money(signedNet)}`}
                    </p>
                    <p className={cn("mt-1 text-[10px] font-bold", row.availability === "blocked" ? "text-rose-600 dark:text-rose-300" : "text-muted-foreground")}>
                      {FINANCE_AVAILABILITY_LABELS[row.availability]}
                    </p>
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 bg-card/95 px-4 py-4 text-right group-hover:bg-muted/95">
                    {renderActions ? renderActions(row) : <MoreHorizontal className="ml-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
