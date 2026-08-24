const normalize = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

const CANCEL_RE = /\b(cancela|cancelar|cancele|para|pare|interrompe|interrompa|deixa|deixa quieto|nao precisa|nao faca|nao faz|desiste|desisto|esquece|encerra)\b/i;
const COMPLEMENT_RE = /\b(tambem|inclui|incluir|adiciona|adicionar|aproveita|alem disso|e tambem|na verdade|corrigindo|complementa|so que|melhor|faz junto)\b/i;

export function classifyInterruption(text) {
  const normalized = normalize(text);
  if (!normalized) return "unknown";
  if (CANCEL_RE.test(normalized)) return "cancel";
  if (COMPLEMENT_RE.test(normalized)) return "complement";
  return "new_turn";
}

export function isUserRole(value) {
  return ["user", "human"].includes(normalize(value));
}

export function isAssistantRole(value) {
  return ["assistant", "agent", "ai"].includes(normalize(value));
}
