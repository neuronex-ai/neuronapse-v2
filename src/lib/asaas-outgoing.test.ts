import { describe, expect, it } from "vitest";

import {
  detectPixKeyType,
  isExpired,
  normalizeExternalPixKeyLookup,
  normalizePixKeyForProvider,
  normalizePixQrConsultation,
  normalizePixTransactionStatus,
  normalizeTransferStatus,
  validatePixQrConsultation,
} from "../../supabase/functions/_shared/asaas-outgoing";

describe("secure outgoing normalizers", () => {
  it("accepts a payable variable Pix without a fixed amount", () => {
    const consultation = normalizePixQrConsultation({
      payload: "000201",
      canBePaid: true,
      canBePaidWithDifferentValue: true,
      receiver: {
        name: "Clínica Exemplo",
        cpfCnpj: "12345678000199",
        ispbName: "Banco Exemplo",
      },
    });

    expect(validatePixQrConsultation(consultation)).toEqual([]);
  });

  it("requires amount for a fixed Pix", () => {
    const consultation = normalizePixQrConsultation({
      payload: "000201",
      canBePaid: true,
      receiver: {
        name: "Paciente Exemplo",
        cpfCnpj: "12345678901",
        ispb: "12345678",
      },
    });

    expect(validatePixQrConsultation(consultation)).toContain("value");
  });

  it("detects and normalizes supported Pix keys", () => {
    expect(detectPixKeyType("nome@exemplo.com")).toBe("EMAIL");
    expect(detectPixKeyType("123.456.789-01")).toBe("CPF");
    expect(detectPixKeyType("12.345.678/0001-01")).toBe("CNPJ");
    expect(detectPixKeyType("b6295ee1-f054-47d1-9e90-ee57b74f60d9")).toBe("EVP");
    expect(normalizePixKeyForProvider("+55 (11) 99999-9999", "PHONE")).toBe("+5511999999999");
  });

  it("normalizes alternate DICT lookup response shapes", () => {
    expect(normalizeExternalPixKeyLookup({
      ownerName: "Titular Exemplo",
      ownerDocument: "12345678901",
      institutionName: "Banco Exemplo",
      addressKey: "12345678901",
      keyType: "CPF",
    })).toMatchObject({
      holderName: "Titular Exemplo",
      holderDocument: "12345678901",
      bankName: "Banco Exemplo",
      key: "12345678901",
      type: "CPF",
    });
  });

  it("expires frozen consultations after their deadline", () => {
    expect(isExpired({ consultation_expires_at: new Date(Date.now() - 1_000).toISOString() })).toBe(true);
    expect(isExpired({ consultation_expires_at: new Date(Date.now() + 60_000).toISOString() })).toBe(false);
  });

  it("normalizes provider statuses for receipts and history", () => {
    expect(normalizePixTransactionStatus("DONE")).toBe("paid");
    expect(normalizePixTransactionStatus("REFUSED")).toBe("failed");
    expect(normalizeTransferStatus("BANK_PROCESSING")).toBe("in_transit");
    expect(normalizeTransferStatus("CANCELLED")).toBe("canceled");
  });
});
