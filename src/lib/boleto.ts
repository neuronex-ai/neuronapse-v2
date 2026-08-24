export function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function modulo10Digit(value: string) {
  let factor = 2;
  let sum = 0;

  for (let index = value.length - 1; index >= 0; index -= 1) {
    const product = Number(value[index]) * factor;
    sum += Math.floor(product / 10) + (product % 10);
    factor = factor === 2 ? 1 : 2;
  }

  return (10 - (sum % 10)) % 10;
}

function modulo11BoletoDigit(value: string) {
  let factor = 2;
  let sum = 0;

  for (let index = value.length - 1; index >= 0; index -= 1) {
    sum += Number(value[index]) * factor;
    factor = factor === 9 ? 2 : factor + 1;
  }

  const digit = 11 - (sum % 11);
  return digit === 0 || digit === 10 || digit === 11 ? 1 : digit;
}

function boletoLineToBarcode(digits: string) {
  return `${digits.slice(0, 4)}${digits[32]}${digits.slice(33, 47)}${digits.slice(4, 9)}${digits.slice(10, 20)}${digits.slice(21, 31)}`;
}

function hasValidGeneralBoletoDigit(digits: string) {
  const barcode = boletoLineToBarcode(digits);
  const withoutGeneralDigit = `${barcode.slice(0, 4)}${barcode.slice(5)}`;
  return modulo11BoletoDigit(withoutGeneralDigit) === Number(digits[32]);
}

export function isValidBoletoDigits(value: string) {
  const digits = onlyDigits(value);

  if (digits.length === 47 && digits[0] !== "8") {
    return modulo10Digit(digits.slice(0, 9)) === Number(digits[9])
      && modulo10Digit(digits.slice(10, 20)) === Number(digits[20])
      && modulo10Digit(digits.slice(21, 31)) === Number(digits[31])
      && hasValidGeneralBoletoDigit(digits);
  }

  // Arrecadacao/utility bills use 48 digits and always begin with product code 8.
  if (digits.length === 48) return digits[0] === "8";

  // Barcode readers commonly return the canonical 44-digit barcode directly.
  return digits.length === 44;
}

export function normalizeBoletoInput(value: string) {
  const digits = onlyDigits(value);
  return {
    digits,
    kind: digits.length === 44 ? "barcode" : "identificationField",
    isValid: [44, 47, 48].includes(digits.length),
  } as const;
}

export function formatBoletoValue(value: string) {
  const digits = onlyDigits(value);
  if (digits.length <= 44) return digits;
  if (digits.length === 48 && digits[0] === "8") {
    return digits.replace(/(\d{11})(\d)(\d{11})(\d)(\d{11})(\d)(\d{11})(\d)/, "$1-$2 $3-$4 $5-$6 $7-$8");
  }
  return digits.replace(/(\d{5})(\d{5})(\d{5})(\d{6})(\d{5})(\d{6})(\d{1})(\d{14})/, "$1.$2 $3.$4 $5.$6 $7 $8");
}

export function findBoletoCandidate(text: string) {
  const formattedBoletoSegments = text.match(/\d{5}\.?\d{5}\s+\d{5}\.?\d{6}\s+\d{5}\.?\d{6}\s+\d\s+\d{14}/g) || [];
  for (const segment of formattedBoletoSegments) {
    const candidate = onlyDigits(segment);
    if (isValidBoletoDigits(candidate)) return candidate;
  }

  const numericSegments = text.match(/\d[\d.\-\s]{42,120}\d/g) || [];
  const segments = [...numericSegments, text];

  for (const segment of segments) {
    const compact = onlyDigits(segment);

    for (let start = 0; start < compact.length; start += 1) {
      const preferredLengths = compact[start] === "8" ? [48, 47, 44] : [47, 44, 48];
      for (const length of preferredLengths) {
        const candidate = compact.slice(start, start + length);
        if (candidate.length === length && isValidBoletoDigits(candidate)) return candidate;
      }
    }
  }

  return null;
}
