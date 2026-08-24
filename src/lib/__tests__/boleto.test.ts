import { describe, expect, it } from "vitest";
import { findBoletoCandidate, isValidBoletoDigits, normalizeBoletoInput, onlyDigits } from "../boleto";

const VALID_BOLETO = "46191110000000000004250768519014814720000020000";

describe("boleto helpers", () => {
  it("normalizes line input", () => {
    expect(onlyDigits("00190.00009 01234.567890 12345.678901 1 12340000015000")).toBe(
      "00190000090123456789012345678901112340000015000",
    );
  });

  it("detects barcode vs line", () => {
    expect(normalizeBoletoInput("1".repeat(44))).toMatchObject({ kind: "barcode", isValid: true });
    expect(normalizeBoletoInput("1".repeat(47))).toMatchObject({ kind: "identificationField", isValid: true });
  });

  it("finds boleto candidates in text", () => {
    expect(findBoletoCandidate(`boleto ${VALID_BOLETO} fim`)).toBe(VALID_BOLETO);
  });

  it("finds direct 44-digit barcode candidates inside scanner noise", () => {
    const barcode = "1".repeat(44);
    expect(findBoletoCandidate(`raw=${barcode};confidence=0.87`)).toBe(barcode);
  });

  it("removes an adjacent OCR digit instead of treating a bank slip as a 48-digit utility bill", () => {
    expect(VALID_BOLETO).toHaveLength(47);
    expect(isValidBoletoDigits(VALID_BOLETO)).toBe(true);
    expect(findBoletoCandidate(`${VALID_BOLETO}6`)).toBe(VALID_BOLETO);
  });

  it("finds a valid boleto among other numbers extracted from a PDF", () => {
    const formatted = "46191.11000 00000.000042 50768.519014 8 14720000020000";
    expect(findBoletoCandidate(`Emitido em 09/06/2026 ${formatted} 6 Pagina 1`)).toBe(VALID_BOLETO);
  });
});
