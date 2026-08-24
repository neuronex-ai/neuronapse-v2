import { tools as safeTools } from "./tools-safe.ts";

const systemHelp = {
  name: "get_system_help",
  description: "Explica como o NeuroNex funciona e qual módulo usar.",
  parameters: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
  },
};

const humanNames = new Set([
  "get_patient_details",
  "search_clinical_history",
  "create_appointment",
  "reschedule_appointment",
  "cancel_appointment",
]);

const humanize = (tool: any) => {
  if (!humanNames.has(tool.name)) return tool;
  const properties = { ...(tool.parameters?.properties || {}) };
  properties.patientName = {
    type: "string",
    description: "Nome informado pelo profissional. Nunca peça ID ao usuário.",
  };
  const required = (tool.parameters?.required || [])
    .filter((field: string) => !["patientId", "appointmentId"].includes(field));
  if (["get_patient_details", "search_clinical_history", "create_appointment"].includes(tool.name)) {
    required.push("patientName");
  }
  return {
    ...tool,
    description: `${tool.description} Resolva a pessoa pelo nome; IDs são internos.`,
    parameters: { ...(tool.parameters || {}), properties, required: [...new Set(required)] },
  };
};

export const tools = safeTools.map((group: any, index: number) => ({
  ...group,
  functionDeclarations: [
    ...(index === 0 ? [systemHelp] : []),
    ...(group.functionDeclarations || []).map(humanize),
  ],
}));
