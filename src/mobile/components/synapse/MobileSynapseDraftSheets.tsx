import { useAuth } from "@/components/auth/SessionContextProvider";
import { useGenerateInvoice } from "@/hooks/use-generate-invoice";
import { usePatients } from "@/hooks/use-patients";
import { cn } from "@/lib/utils";
import { CheckCircle2, Mail, Send, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { edgeFunctionUrl } from "@/lib/supabase-config";
import {
  mobileSynapseInputClassName,
  MobileSynapseButton,
  MobileSynapseField,
  MobileSynapseSheet,
} from "./MobileSynapsePrimitives";

export interface MobileEmailDraftData {
  to?: string;
  subject?: string;
  body?: string;
  patientName?: string;
}

export interface MobileInvoiceDraftData {
  patientName?: string;
  patientId?: string;
  amount?: number;
  description?: string;
  dueDate?: string;
}

export function MobileSynapseEmailDraftSheet({
  open,
  onOpenChange,
  initialData,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: MobileEmailDraftData | null;
  onSent: () => void;
}) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !initialData) return;
    setTo(initialData.to || "");
    setSubject(initialData.subject || "");
    setBody(initialData.body || "");
  }, [initialData, open]);

  const handleSend = async () => {
    if (!session?.access_token) {
      toast.error("Sessão inválida.");
      return;
    }

    setSending(true);
    try {
      const response = await fetch(edgeFunctionUrl("send-document-email"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          subject,
          htmlBody: body.replace(/\n/g, "<br>"),
          documentType: "Mensagem Direta",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Falha desconhecida no envio.");
      }

      toast.success("E-mail enviado com sucesso.");
      onSent();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao enviar.";
      if (message.includes("Google account not connected") || message.includes("Missing auth header")) {
        toast.error("Conta Google não conectada.", {
          description: "Conecte sua conta em Ajustes > Integrações.",
          action: {
            label: "Conectar",
            onClick: () => {
              onOpenChange(false);
              navigate("/ajustes?tab=integrations");
            },
          },
          duration: 5000,
        });
      } else {
        toast.error(`Erro ao enviar: ${message}`);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <MobileSynapseSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={Mail}
      eyebrow="Rascunho"
      title="Revisar e-mail"
      description="O Synapse preparou a mensagem. Ajuste antes de enviar."
      footer={(
        <div className="grid grid-cols-[0.8fr_1.2fr] gap-2.5">
          <MobileSynapseButton variant="secondary" onClick={() => onOpenChange(false)}>
            Descartar
          </MobileSynapseButton>
          <MobileSynapseButton onClick={handleSend} loading={sending}>
            <Send className="h-4 w-4" />
            Enviar
          </MobileSynapseButton>
        </div>
      )}
    >
      <div className="space-y-4">
        <MobileSynapseField label="Para">
          <input value={to} onChange={(event) => setTo(event.target.value)} className={mobileSynapseInputClassName} />
        </MobileSynapseField>
        <MobileSynapseField label="Assunto">
          <input value={subject} onChange={(event) => setSubject(event.target.value)} className={mobileSynapseInputClassName} />
        </MobileSynapseField>
        <MobileSynapseField label="Mensagem">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={cn(mobileSynapseInputClassName, "h-48 resize-none py-4 leading-relaxed")}
          />
        </MobileSynapseField>
      </div>
    </MobileSynapseSheet>
  );
}

export function MobileSynapseInvoiceDraftSheet({
  open,
  onOpenChange,
  initialData,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: MobileInvoiceDraftData | null;
  onSent: () => void;
}) {
  const { mutate: generateInvoice, isPending } = useGenerateInvoice();
  const { data: patients } = usePatients();
  const [patientId, setPatientId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!open || !initialData) return;
    setAmount(initialData.amount ? String(initialData.amount) : "");
    setDescription(initialData.description || "Sessões de terapia");

    if (initialData.patientId) {
      setPatientId(initialData.patientId);
    } else if (initialData.patientName && patients) {
      const found = patients.find((patient) => patient.name.toLowerCase().includes(initialData.patientName!.toLowerCase()));
      if (found) setPatientId(found.id);
    }

    if (initialData.dueDate) {
      setDueDate(initialData.dueDate);
    } else {
      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + 3);
      setDueDate(nextDueDate.toISOString().split("T")[0]);
    }
  }, [initialData, open, patients]);

  const patientOptions = useMemo(() => patients || [], [patients]);

  const handleConfirm = () => {
    const parsedAmount = Number(amount);
    if (!patientId || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !dueDate) {
      toast.error("Preencha paciente, valor e vencimento.");
      return;
    }

    generateInvoice({
      patientId,
      amount: parsedAmount,
      description,
      dueDate: new Date(`${dueDate}T12:00:00`),
    }, {
      onSuccess: () => {
        onSent();
        onOpenChange(false);
      },
    });
  };

  return (
    <MobileSynapseSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={Wallet}
      eyebrow="Cobrança"
      title="Confirmar lançamento"
      description="Revise os dados antes de emitir a cobrança NeuroFinance."
      footer={(
        <div className="grid grid-cols-[0.8fr_1.2fr] gap-2.5">
          <MobileSynapseButton variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </MobileSynapseButton>
          <MobileSynapseButton onClick={handleConfirm} loading={isPending}>
            <CheckCircle2 className="h-4 w-4" />
            Emitir
          </MobileSynapseButton>
        </div>
      )}
    >
      <div className="space-y-4">
        <MobileSynapseField label="Paciente">
          <select value={patientId} onChange={(event) => setPatientId(event.target.value)} className={mobileSynapseInputClassName}>
            <option value="">Selecione o paciente</option>
            {patientOptions.map((patient) => (
              <option key={patient.id} value={patient.id}>{patient.name}</option>
            ))}
          </select>
        </MobileSynapseField>
        <div className="grid grid-cols-2 gap-3">
          <MobileSynapseField label="Valor">
            <input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} className={mobileSynapseInputClassName} />
          </MobileSynapseField>
          <MobileSynapseField label="Vencimento">
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={mobileSynapseInputClassName} />
          </MobileSynapseField>
        </div>
        <MobileSynapseField label="Descrição">
          <input value={description} onChange={(event) => setDescription(event.target.value)} className={mobileSynapseInputClassName} />
        </MobileSynapseField>
      </div>
    </MobileSynapseSheet>
  );
}
