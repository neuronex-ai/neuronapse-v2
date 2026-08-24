import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FinanceDataTable } from "@/components/financeiro/shared/FinanceDataTable";
import type { FinancePresentationRow } from "@/lib/finance-presentation";

const row: FinancePresentationRow = {
  id: "charge-1",
  sourceId: "payment-1",
  kind: "charge",
  direction: "income",
  patientId: "patient-1",
  patientName: "Ana",
  description: "Sessão clínica",
  typeLabel: "Avulsa",
  origin: "agenda",
  method: "pix",
  competenceAt: "2026-08-24",
  competenceLabel: "24/08/2026",
  status: "confirmed",
  availability: "available",
  grossAmount: 250,
  feeAmount: 5,
  netAmount: 245,
  netApplicability: "known",
  actions: ["open"],
};

describe("FinanceDataTable", () => {
  it("renders the canonical columns with accessible help", async () => {
    render(<FinanceDataTable rows={[row]} context="neurofinance_charges" />);

    expect(screen.getByText("Paciente", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Descrição", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Líquido", { selector: "span" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Entender a coluna/ })).toHaveLength(9);

    const helpButton = screen.getByRole("button", { name: "Entender a coluna Competência" });
    fireEvent.click(helpButton);
    expect(await screen.findByText(/Nas cobranças, corresponde ao vencimento/)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText(/Nas cobranças, corresponde ao vencimento/)).not.toBeInTheDocument());
    await waitFor(() => expect(helpButton).toHaveFocus());
  }, 10_000);

  it("supports row selection and masked values", () => {
    const onToggleRow = vi.fn();
    render(<FinanceDataTable rows={[row]} selectedIds={new Set()} onToggleRow={onToggleRow} maskValues />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Sessão clínica" }));
    expect(onToggleRow).toHaveBeenCalledWith("charge-1", true);
    expect(screen.getAllByText("R$ ••••••")).toHaveLength(2);
  });
});
