import type { AgentToolResult } from "./executor.ts";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const localDateTime = (value?: string) => {
  if (!value) return "data não informada";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
};

const statusLabel = (value?: string) => {
  const labels: Record<string, string> = {
    active: "ativo",
    pending: "pendente",
    inactive: "inativo",
    confirmed: "confirmada",
    cancelled: "cancelada",
    paid: "pago",
    pending_review: "em análise",
  };
  return labels[String(value || "").toLowerCase()] || String(value || "não informado");
};

export function formatGroundedResult(toolName: string, result: AgentToolResult): string {
  if (!result.ok) return `Não consegui concluir a consulta: ${result.error || "erro desconhecido"}`;

  switch (toolName) {
    case "list_patients": {
      const patients = result.data?.patients || [];
      if (!patients.length) return "Não encontrei pacientes com esses critérios.";
      const lines = patients.map((patient: any, index: number) =>
        `${index + 1}. **${patient.name}** — ${statusLabel(patient.status)}${patient.diagnosis ? `; ${patient.diagnosis}` : ""}.`);
      return `Encontrei ${patients.length} paciente${patients.length === 1 ? "" : "s"}:\n\n${lines.join("\n")}`;
    }

    case "search_patients": {
      const patients = result.data?.patients || [];
      if (!patients.length) return `Não encontrei paciente com o nome “${result.data?.query || "informado"}”.`;
      if (patients.length === 1) {
        const patient = patients[0];
        return `Encontrei **${patient.name}**, atualmente ${statusLabel(patient.status)}${patient.diagnosis ? `, com registro de ${patient.diagnosis}` : ""}.`;
      }
      return `Encontrei ${patients.length} correspondências:\n\n${patients.map((patient: any, index: number) => `${index + 1}. **${patient.name}** — ${statusLabel(patient.status)}.`).join("\n")}`;
    }

    case "get_patient_details": {
      const patient = result.data?.patient;
      if (!patient) return "Não encontrei esse paciente no sistema.";
      const details = [
        `Status: ${statusLabel(patient.status)}`,
        patient.diagnosis ? `Registro clínico: ${patient.diagnosis}` : null,
        patient.phone ? `Telefone: ${patient.phone}` : null,
        patient.email ? `E-mail: ${patient.email}` : null,
        patient.last_session ? `Última sessão: ${localDateTime(patient.last_session)}` : null,
        patient.next_session ? `Próxima sessão: ${localDateTime(patient.next_session)}` : null,
        patient.risk_score !== null && patient.risk_score !== undefined ? `Indicador de risco: ${patient.risk_score}` : null,
      ].filter(Boolean);
      return `**${patient.name}**\n\n${details.map((item) => `- ${item}`).join("\n")}`;
    }

    case "get_clinical_history": {
      const patient = result.data?.patient;
      const notes = result.data?.notes || [];
      if (!notes.length) return `Não encontrei anotações no prontuário de ${patient?.name || "esse paciente"}.`;
      const lines = notes.map((note: any, index: number) =>
        `${index + 1}. **${localDateTime(note.date)}** — ${note.summary}`);
      return `Encontrei ${notes.length} registro${notes.length === 1 ? "" : "s"} no prontuário de **${patient?.name || "paciente"}**:\n\n${lines.join("\n")}`;
    }

    case "get_calendar": {
      const appointments = result.data?.appointments || [];
      if (!appointments.length) return "Não encontrei compromissos nesse período.";
      const lines = appointments.map((appointment: any, index: number) =>
        `${index + 1}. **${appointment.patient_name}** — ${appointment.start_time_local}; ${statusLabel(appointment.status)}${appointment.type ? `; ${appointment.type}` : ""}.`);
      return `Encontrei ${appointments.length} compromisso${appointments.length === 1 ? "" : "s"}:\n\n${lines.join("\n")}`;
    }

    case "find_available_slots": {
      const slots = result.data?.slots || [];
      if (!slots.length) return "Não encontrei horários livres nesse período.";
      return `Encontrei ${slots.length} horário${slots.length === 1 ? "" : "s"} livre${slots.length === 1 ? "" : "s"}:\n\n${slots.map((slot: any, index: number) => `${index + 1}. **${slot.date}**, às **${slot.time}**.`).join("\n")}`;
    }

    case "get_financial_summary": {
      const data = result.data || {};
      return [
        `Resumo financeiro de **${data.start_date}** a **${data.end_date}**:`,
        `- Receitas: **${money(data.income)}**`,
        `- Despesas: **${money(data.expenses)}**`,
        `- Saldo gerencial: **${money(data.balance)}**`,
        `- Valores pendentes: **${money(data.pending)}**`,
        `- Lançamentos considerados: **${data.entries_count || 0}**`,
      ].join("\n");
    }

    case "list_financial_entries": {
      const entries = result.data?.entries || [];
      if (!entries.length) return "Não encontrei lançamentos financeiros com esses critérios.";
      return `Encontrei ${entries.length} lançamento${entries.length === 1 ? "" : "s"}:\n\n${entries.map((entry: any, index: number) => `${index + 1}. **${entry.title || entry.description || "Lançamento"}** — ${money(entry.amount)}; ${entry.type === "expense" ? "despesa" : "receita"}; ${statusLabel(entry.status)}; ${entry.due_date || "sem data"}.`).join("\n")}`;
    }

    case "list_personal_notes": {
      const notes = result.data?.notes || [];
      if (!notes.length) return "Não encontrei notas com esses critérios.";
      return `Encontrei ${notes.length} nota${notes.length === 1 ? "" : "s"}:\n\n${notes.map((note: any, index: number) => `${index + 1}. **${note.title}** — ${note.preview || "sem conteúdo"}`).join("\n")}`;
    }

    case "list_documents": {
      const documents = result.data?.documents || [];
      if (!documents.length) return "Não encontrei documentos armazenados com esses critérios.";
      return `Encontrei ${documents.length} documento${documents.length === 1 ? "" : "s"}:\n\n${documents.map((document: any, index: number) => `${index + 1}. **${document.original_name}** — ${document.category}; ${document.status}; ${Number(document.size_bytes || 0).toLocaleString("pt-BR")} bytes.`).join("\n")}`;
    }

    case "request_interface_action":
      return result.clientAction?.data?.reason || "Ação preparada na interface.";

    default:
      return result.message || "Operação concluída com base nos dados do sistema.";
  }
}
