/**
 * Parse amounts typed in Dutch style: comma as decimal separator, optional thousand dots (1.234,56).
 */
export function parseAmountInput(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '');
  if (t === '' || t === '-' || t === ',' || t === '.') {
    return null;
  }
  const nlThousands = /^(\d{1,3}(?:\.\d{3})*),(\d+)$/.exec(t);
  if (nlThousands?.[1] !== undefined && nlThousands[2] !== undefined) {
    const intPart = nlThousands[1].replace(/\./g, '');
    const n = Number(`${intPart}.${nlThousands[2]}`);
    return Number.isFinite(n) ? n : null;
  }
  const normalized = t.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Always show two fraction digits (e.g. 100 → "100,00"). */
export function formatAmountInputDisplay(n: number): string {
  return n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
