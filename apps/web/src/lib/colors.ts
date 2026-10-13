/** Categorical palette tuned for dark map backgrounds (distinct hue + similar luminance). */
const PALETTE = [
  '#4cc9f0',
  '#f72585',
  '#b5e48c',
  '#ffd166',
  '#b388ff',
  '#ff9f1c',
  '#2ec4b6',
  '#ff6b6b',
  '#8ecae6',
  '#e5989b',
] as const;

/** Stable colour per satellite = its rank in the (sorted) catalogue. */
export function satelliteColors(ids: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    [...ids].sort().map((id, i) => [id, PALETTE[i % PALETTE.length] as string]),
  );
}
