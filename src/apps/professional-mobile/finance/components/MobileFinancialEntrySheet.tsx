import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { useAddTransaction } from "@/hooks/use-add-transaction";
import { usePatients } from "@/hooks/use-patients";
import { cn } from "@/lib/utils";
import {
  MobileFinanceButton,
  MobileFinanceField,
  MobileFinanceSelect,
  MobileFinanceSheet,
  mobileFinanceInputClassName,
  parseMoney,
} from "../../shared/MobileFinancePrimitives";

type EntryType = "income" | "expense";
type MobilePatientOption = {
  id: string;
  name?: string | null;
};

export function MobileFinancialEntrySheet({
  open,
  onOpenChange,
  defaultType = "income",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: EntryType;
}) {
  const addTransaction = useAddTransaction();
  const { data: patientData = [] } = usePatients();
  const patients = patientData as MobilePatientOption[];
  const [type, setType] = useState<EntryType>(defaultType);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [patientId, setPatientId] = useState("");

  useEffect(() => {
    if (open) setType(defaultType);
  }, [defaultType, open]);

  const numericAmount = useMemo(() => parseMoney(amount), [amount]);
  const valid = description.trim().length >= 2 && numericAmount > 0 && Boolean(date);

  const resetFields = () => {
    setDescription("");
    setAmount("");
    setCategory("");
    setPatientId("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setPaymentMethod("pix");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) resetFields();
  };

  const closeAndReset = () => {
    onOpenChange(false);
    resetFields();
  };

  const submit = async () => {
    if (!valid) return;
    try {
      await addTransaction.mutateAsync({
        description: description.trim(),
        amount: numericAmount,
        type,
        category: category.trim() || undefined,
        date: new Date(`${date}T12:00:00`),
        payment_method: paymentMethod,
        patient_id: patientId || undefined,
        debit_session: false,
      });
      toast.success(type === "income" ? "Entrada registrada." : "Despesa registrada.");
      closeAndReset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  };

  return (
    <MobileFinanceSheet
      open={open}
      onOpenChange={handleOpenChange}
      eyebrow="Gestão Financeira"
      title="Novo lançamento"
      description="Registre um movimento administrativo. Esta ação não movimenta saldo da conta NeuroFinance."
      icon={type === "income" ? ArrowUpRight : ArrowDownRight}
      footer={
        <MobileFinanceButton
          disabled={!valid}
          loading={addTransaction.isPending}
          onClick={() => void submit()}
          className="min-h-14 w-full rounded-[18px]"
        >
          Salvar lançamento
        </MobileFinanceButton>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2 rounded-[20px] border border-border/40 bg-card/60 p-1.5 dark:border-white/10 dark:bg-white/[0.03]">
          {[
            { value: "income" as const, label: "Entrada", icon: ArrowUpRight },
            { value: "expense" as const, label: "Despesa", icon: ArrowDownRight },
          ].map((item) => {
            const Icon = item.icon;
            const active = type === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setType(item.value)}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 rounded-[15px] text-[11px] font-black uppercase tracking-[0.1em] transition",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground active:bg-foreground/[0.045]",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        <MobileFinanceField label="Descrição">
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ex.: sessão, aluguel, material"
            className={mobileFinanceInputClassName}
          />
        </MobileFinanceField>

        <MobileFinanceField label="Valor">
          <Input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className={cn(mobileFinanceInputClassName, "h-14 text-xl font-black tracking-[-0.03em]")}
          />
        </MobileFinanceField>

        <div className="grid grid-cols-2 gap-3">
          <MobileFinanceField label="Data">
            <Input
              value={date}
              onChange={(event) => setDate(event.target.value)}
              type="date"
              className={mobileFinanceInputClassName}
            />
          </MobileFinanceField>
          <MobileFinanceField label="Categoria">
            <Input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Opcional"
              className={mobileFinanceInputClassName}
            />
          </MobileFinanceField>
        </div>

        <MobileFinanceField label="Forma de pagamento">
          <MobileFinanceSelect
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
          >
            <option value="pix">Pix</option>
            <option value="cash">Dinheiro</option>
            <option value="card">Cartão</option>
            <option value="external_transfer">Transferência externa</option>
            <option value="boleto">Boleto</option>
            <option value="manual">Outro</option>
          </MobileFinanceSelect>
        </MobileFinanceField>

        <MobileFinanceField label="Paciente relacionado">
          <MobileFinanceSelect
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
          >
            <option value="">Nenhum paciente</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name || "Paciente"}
              </option>
            ))}
          </MobileFinanceSelect>
        </MobileFinanceField>
      </div>
    </MobileFinanceSheet>
  );
}
