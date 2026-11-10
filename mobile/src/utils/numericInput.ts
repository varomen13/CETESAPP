export function sanitizeDecimalInput(
  value: string,
  maxIntegerDigits: number,
  maxFractionDigits = 2,
): string {
  const normalized = value.replace(',', '.');
  const decimalIndex = normalized.indexOf('.');
  const hasDecimal = decimalIndex >= 0;
  const integerPart = (hasDecimal
    ? normalized.slice(0, decimalIndex)
    : normalized
  )
    .replace(/\D/g, '')
    .slice(0, maxIntegerDigits);
  const fractionPart = hasDecimal
    ? normalized
        .slice(decimalIndex + 1)
        .replace(/\D/g, '')
        .slice(0, maxFractionDigits)
    : '';

  return hasDecimal ? `${integerPart}.${fractionPart}` : integerPart;
}

export function sanitizeDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}
