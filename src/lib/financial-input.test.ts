import { describe, expect, it } from "vitest";

import {
  formatDocumentInput,
  formatMoneyInput,
  formatPixKeyInput,
  moneyInputToCents,
  normalizePixKeyInput,
  onlyDigits,
} from "./financial-input";

describe("financial input formatters", () => {
  it("limits and formats documents without changing the normalized value", () => {
    expect(formatDocumentInput("123456789014999")).toBe("12.345.678/9014-99");
    expect(onlyDigits(formatDocumentInput("12345678901"))).toBe("12345678901");
  });

  it("formats and normalizes Pix keys by type", () => {
    expect(formatPixKeyInput("12345678901", "cpf")).toBe("123.456.789-01");
    expect(normalizePixKeyInput("+55 (11) 99999-9999", "telefone")).toBe("+5511999999999");
  });

  it("formats Brazilian money while preserving cents", () => {
    expect(formatMoneyInput("1234,56")).toBe("1.234,56");
    expect(moneyInputToCents("1.234,56")).toBe(123456);
  });
});
