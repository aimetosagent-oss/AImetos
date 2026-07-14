export type DocumentLineInput = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  discountBps?: number;
  taxRateBps?: number;
  productId?: string | null;
};

export function calculateDocumentLines(inputs: DocumentLineInput[]) {
  if (!inputs.length) throw new Error("Cal afegir almenys una línia");
  const lines = inputs.map((input, position) => {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error("La quantitat ha de ser un enter positiu");
    if (!Number.isInteger(input.unitPriceCents) || input.unitPriceCents < 0) throw new Error("El preu ha d’estar expressat en cèntims");
    const discountBps = input.discountBps ?? 0;
    const taxRateBps = input.taxRateBps ?? 0;
    if (![discountBps, taxRateBps].every((rate) => Number.isInteger(rate) && rate >= 0 && rate <= 10_000)) {
      throw new Error("Percentatge fora de rang");
    }
    const subtotalCents = input.quantity * input.unitPriceCents;
    const discountAmountCents = Math.round((subtotalCents * discountBps) / 10_000);
    const taxableCents = subtotalCents - discountAmountCents;
    const taxAmountCents = Math.round((taxableCents * taxRateBps) / 10_000);
    return {
      ...input,
      discountBps,
      taxRateBps,
      subtotalCents,
      discountAmountCents,
      taxAmountCents,
      totalCents: taxableCents + taxAmountCents,
      position,
    };
  });
  const subtotalCents = lines.reduce((sum, line) => sum + line.subtotalCents, 0);
  const discountAmountCents = lines.reduce((sum, line) => sum + line.discountAmountCents, 0);
  const taxAmountCents = lines.reduce((sum, line) => sum + line.taxAmountCents, 0);
  return { lines, subtotalCents, discountAmountCents, taxAmountCents, totalCents: subtotalCents - discountAmountCents + taxAmountCents };
}
