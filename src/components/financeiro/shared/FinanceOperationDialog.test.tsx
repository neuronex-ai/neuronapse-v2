import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FinanceOperationDialog } from "@/components/financeiro/shared/FinanceOperationDialog";

describe("FinanceOperationDialog", () => {
  it("explains the refund impact and keeps confirmation blocked without a validated backend", () => {
    const onOpenChange = vi.fn();
    render(
      <FinanceOperationDialog
        open
        onOpenChange={onOpenChange}
        operation="refund"
        description="Sessão clínica"
        amount={250}
        availability="available"
      />,
    );

    expect(screen.getByRole("heading", { name: "Preparar reembolso" })).toBeInTheDocument();
    expect(screen.getByText("R$ 250,00")).toBeInTheDocument();
    expect(screen.getByText(/contrato backend/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar reembolso" })).toBeDisabled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
