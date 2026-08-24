import { describe, expect, it } from "vitest";
import { isCompositeSystemQuery } from "./synapse-grounded-query";

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("isCompositeSystemQuery", () => {
  it("routes patient summaries with multiple domains to the full Synapse agent", () => {
    expect(isCompositeSystemQuery(normalize(
      "Me resuma tudo que sabemos sobre a paciente Maria: ultimas consultas e se ela esta paga.",
    ))).toBe(true);
  });

  it("keeps simple patient list queries eligible for the local fast path", () => {
    expect(isCompositeSystemQuery(normalize("listar pacientes cadastrados"))).toBe(false);
  });

  it("routes patient timelines to the full Synapse agent", () => {
    expect(isCompositeSystemQuery(normalize("monte a linha do tempo desse paciente"))).toBe(true);
  });
});
