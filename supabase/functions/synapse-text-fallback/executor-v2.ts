import {
  executeAgentTool as executeBaseTool,
  executeConfirmedMutation as executeBaseMutation,
  type AgentToolContext,
  type AgentToolResult,
  type PendingAction,
} from "./executor.ts";
import { resolvePatientByName, formatPatientAmbiguity } from "./patient-resolver.ts";
import { getSystemHelp, formatSystemHelp } from "./system-help.ts";

export type { AgentToolContext, AgentToolResult, PendingAction };

const PATIENT_AWARE = new Set([
  "get_patient_details",
  "get_clinical_history",
  "get_calendar",
  "list_documents",
  "request_interface_action",
  "update_patient",
  "create_session_note",
  "create_appointment",
  "reschedule_appointment",
  "cancel_appointment",
  "create_financial_entry",
]);

const clarification = (message: string, candidates: any[] = []): AgentToolResult => ({
  ok: true,
  grounded: true,
  recordCount: candidates.length,
  data: { clarification_required: true, candidates },
  message,
  structuredData: {
    type: "clarification_required",
    data: { message, candidates },
  },
});

async function resolveArgs(
  name: string,
  args: Record<string, any>,
  context: AgentToolContext,
): Promise<{ args?: Record<string, any>; result?: AgentToolResult }> {
  if (!PATIENT_AWARE.has(name) || args.patient_id || !args.patient_name) return { args };

  const resolution = await resolvePatientByName(context.admin, context.userId, args.patient_name);
  if (resolution.status === "not_found") {
    return {
      result: clarification(`Não encontrei nenhum paciente correspondente a “${String(args.patient_name).slice(0, 120)}”. Confira o nome e tente novamente.`),
    };
  }

  if (resolution.status === "ambiguous") {
    const candidates = resolution.candidates.map((patient) => ({
      name: patient.name,
      status: patient.status,
      diagnosis: patient.diagnosis,
      next_session: patient.next_session,
    }));
    return { result: clarification(formatPatientAmbiguity(resolution.candidates), candidates) };
  }

  return {
    args: {
      ...args,
      patient_id: resolution.patient.id,
      patient_name: resolution.patient.name,
    },
  };
}

export async function executeAgentTool(
  name: string,
  args: Record<string, any>,
  context: AgentToolContext,
): Promise<AgentToolResult> {
  if (name === "get_system_help") {
    const data = getSystemHelp(args.query);
    return {
      ok: true,
      grounded: true,
      recordCount: data.entries.length,
      data,
      message: formatSystemHelp(data),
      structuredData: { type: "system_help", data },
    };
  }

  if (name === "get_workspace_overview") {
    return {
      ok: true,
      grounded: true,
      recordCount: 0,
      data: {},
      message: "Posso consultar pacientes, agenda, prontuário, finanças, notas e documentos. Diga qual área você deseja revisar.",
      structuredData: { type: "workspace_overview", data: {} },
    };
  }

  const resolved = await resolveArgs(name, args, context);
  if (resolved.result) return resolved.result;
  return executeBaseTool(name, resolved.args || args, context);
}

export async function executeConfirmedMutation(
  pending: PendingAction,
  context: AgentToolContext,
): Promise<AgentToolResult> {
  const resolved = await resolveArgs(
    pending.toolName,
    pending.arguments as Record<string, any>,
    context,
  );
  if (resolved.result) return resolved.result;
  return executeBaseMutation({
    ...pending,
    arguments: resolved.args || pending.arguments,
  }, context);
}
