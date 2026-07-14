export type LineInput = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  discountPercent?: number;
  taxRate?: number;
};

export type CalculatedLine = LineInput & {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
};

export function calculateLine(input: LineInput): CalculatedLine {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("La quantitat ha de ser positiva");
  if (!Number.isInteger(input.unitPriceCents) || input.unitPriceCents < 0) throw new Error("El preu ha d’estar en cèntims");
  const discountPercent = input.discountPercent ?? 0;
  const taxRate = input.taxRate ?? 0;
  if (discountPercent < 0 || discountPercent > 100 || taxRate < 0 || taxRate > 100) {
    throw new Error("Percentatge fora de rang");
  }
  const subtotalCents = Math.round(input.quantity * input.unitPriceCents);
  const discountCents = Math.round((subtotalCents * discountPercent) / 100);
  const taxableCents = subtotalCents - discountCents;
  const taxCents = Math.round((taxableCents * taxRate) / 100);
  return { ...input, discountPercent, taxRate, subtotalCents, discountCents, taxCents, totalCents: taxableCents + taxCents };
}

export function calculateDocument(lines: LineInput[]) {
  if (lines.length === 0) throw new Error("Cal afegir almenys una línia");
  const calculatedLines = lines.map(calculateLine);
  const subtotalCents = calculatedLines.reduce((sum, line) => sum + line.subtotalCents, 0);
  const discountCents = calculatedLines.reduce((sum, line) => sum + line.discountCents, 0);
  const taxCents = calculatedLines.reduce((sum, line) => sum + line.taxCents, 0);
  return {
    lines: calculatedLines,
    subtotalCents,
    discountCents,
    taxCents,
    totalCents: subtotalCents - discountCents + taxCents,
  };
}

export function formatMoney(cents: number, currency = "EUR", locale = "ca-ES") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}
