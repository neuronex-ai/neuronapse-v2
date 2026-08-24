import { describe, expect, it } from "vitest";

import { formatReceiptDate, isCnpj, isCpf, receiptFiscalNotice, receiptReference } from "@/lib/receipt-document";

describe("receipt document contract", () => {
  it("derives a stable reference from the related operation", () => {
    expect(receiptReference("payment-1234-abcd")).toBe("NNX-PAYMENT1234ABC");
    expect(receiptReference("payment-1234-abcd")).toBe(receiptReference("payment-1234-abcd"));
  });

  it("does not claim to replace Receita Saúde or NFS-e", () => {
    expect(receiptFiscalNotice("individual")).toContain("não substitui");
    expect(receiptFiscalNotice("individual")).toContain("Receita Saúde");
    expect(receiptFiscalNotice("company")).toContain("não substitui");
    expect(receiptFiscalNotice("company")).toContain("NFS-e");
  });

  it("classifies documents by digit length", () => {
    expect(isCpf("123.456.789-00")).toBe(true);
    expect(isCnpj("12.345.678/0001-00")).toBe(true);
  });

  it("does not invent a date when the source is absent", () => {
    expect(formatReceiptDate()).toBe("Data não informada");
  });
});
