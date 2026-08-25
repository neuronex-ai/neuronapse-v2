import { describe, expect, it } from "vitest";

import type { Appointment } from "@/types";
import { buildDashboardSynapseSuggestions } from "./dashboard-clinical-flow-model";

const appointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: "appointment-1",
  user_id: "user-1",
  patient_id: "patient-1",
  start_time: "2026-08-24T21:30:00-03:00",
  end_time: "2026-08-24T22:20:00-03:00",
  type: "online",
  status: "pending",
  notes: null,
  location: null,
  created_at: "2026-08-01T10:00:00-03:00",
  patient_name: "Ana",
  ...overrides,
});

describe("buildDashboardSynapseSuggestions", () => {
  it("always returns exactly three suggestions", () => {
    const suggestions = buildDashboardSynapseSuggestions({
      now: new Date("2026-08-24T21:00:00-03:00"),
      appointments: [],
      notifications: [],
      waitlistCount: 0,
      pendingPatients: 0,
      receivable: 0,
      neurofinancePending: 0,
    });

    expect(suggestions).toHaveLength(3);
  });

  it("prioritizes live clinical context instead of fixed prompts", () => {
    const suggestions = buildDashboardSynapseSuggestions({
      now: new Date("2026-08-24T21:00:00-03:00"),
      appointments: [appointment()],
      notifications: [
        {
          id: "notice-1",
          category: "prontuario",
          severity: "warning",
          title: "Resumo aguardando confirmação",
          message: "Revise antes de confirmar.",
          isRead: false,
        },
      ],
      waitlistCount: 2,
      pendingPatients: 1,
      receivable: 0,
      neurofinancePending: 0,
    });

    expect(suggestions).toHaveLength(3);
    expect(suggestions[0]?.prompt).toContain("Ana");
    expect(suggestions.some((item) => item.reason === "Prontuário")).toBe(true);
    expect(suggestions.some((item) => item.reason === "Agenda")).toBe(true);
  });
});
