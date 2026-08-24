import { tools as currentTools } from "./tools-def.ts";

const navigationTool = {
  name: "navigate_system",
  description: "Solicita uma ação visual estruturada. Não aceita rotas, URLs ou seletores.",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["navigate", "open_patient", "open_patient_record", "open_daily_schedule", "scroll_to_appointment", "highlight_element", "open_modal"] },
      target: { type: "string", enum: ["dashboard", "agenda", "patients", "finance", "notes", "teleconsultation", "synapse"] },
      patientId: { type: "string" },
      appointmentId: { type: "string" },
      date: { type: "string" },
      element: { type: "string", enum: ["next_appointment", "daily_schedule", "patient_header", "financial_balance"] },
      modal: { type: "string", enum: ["new_appointment", "new_patient", "new_transaction", "patient_details"] },
      reason: { type: "string" }
    },
    required: ["action"]
  }
};

export const tools = currentTools.map((group: any) => ({
  ...group,
  functionDeclarations: (group.functionDeclarations || []).map((item: any) =>
    item.name === "navigate_system" ? navigationTool : item
  )
}));
