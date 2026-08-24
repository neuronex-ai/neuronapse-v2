export type PixKeyInputType = "cpf" | "cnpj" | "email" | "telefone" | "evp" | "auto";

export function onlyDigits(value: unknown, maxLength?: number) {
  const digits = String(value || "").replace(/\D/g, "");
  return typeof maxLength === "number" ? digits.slice(0, maxLength) : digits;
}

export function formatCpf(value: unknown) {
  const digits = onlyDigits(value, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function formatCnpj(value: unknown) {
  const digits = onlyDigits(value, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatDocumentInput(value: unknown) {
  const digits = onlyDigits(value, 14);
  return digits.length <= 11 ? formatCpf(digits) : formatCnpj(digits);
}

export function formatPhoneInput(value: unknown) {
  const original = String(value || "").trim();
  let digits = onlyDigits(original, 13);
  if (!original.startsWith("+") && digits.length <= 11) {
    if (digits.length <= 10) {
      return digits
        .replace(/^(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  }
  if (digits.startsWith("55")) digits = digits.slice(2);
  const local = digits.slice(0, 11);
  return `+55 ${local
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")}`.trim();
}

export function formatPixKeyInput(value: unknown, type: PixKeyInputType = "auto") {
  const raw = String(value || "").trim();
  const resolved = type === "auto"
    ? raw.includes("@")
      ? "email"
      : /^[0-9a-f-]{32,}$/i.test(raw) && raw.includes("-")
        ? "evp"
        : raw.startsWith("+")
          ? "telefone"
          : onlyDigits(raw).length > 11
            ? "cnpj"
            : "cpf"
    : type;

  if (resolved === "cpf") return formatCpf(raw);
  if (resolved === "cnpj") return formatCnpj(raw);
  if (resolved === "telefone") return formatPhoneInput(raw);
  if (resolved === "email") return raw.replace(/\s/g, "").slice(0, 254);
  return raw.replace(/[^0-9a-f-]/gi, "").slice(0, 36);
}

export function normalizePixKeyInput(value: unknown, type: PixKeyInputType = "auto") {
  const raw = String(value || "").trim();
  if (type === "email") return raw.toLowerCase();
  if (type === "evp") return raw.toLowerCase();
  if (type === "telefone") {
    const digits = onlyDigits(raw, 13);
    return raw.startsWith("+") || digits.startsWith("55") ? `+${digits}` : digits;
  }
  if (type === "cpf" || type === "cnpj") return onlyDigits(raw);
  return raw.includes("@") || raw.includes("-") ? raw : onlyDigits(raw);
}

export function formatMoneyInput(value: unknown) {
  const raw = String(value || "").replace(/[^\d,.]/g, "");
  if (!raw) return "";
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);
  const hasDecimal = decimalIndex >= 0 && raw.length - decimalIndex - 1 <= 2;
  const integerDigits = onlyDigits(hasDecimal ? raw.slice(0, decimalIndex) : raw).replace(/^0+(?=\d)/, "") || "0";
  const decimals = hasDecimal ? onlyDigits(raw.slice(decimalIndex + 1), 2) : "";
  const integer = Number(integerDigits).toLocaleString("pt-BR");
  return `${integer}${hasDecimal ? `,${decimals}` : ""}`;
}

export function moneyInputToCents(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const amount = Number(normalized.replace(/[^\d.]/g, ""));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function moneyInputToNumber(value: unknown) {
  return moneyInputToCents(value) / 100;
}
