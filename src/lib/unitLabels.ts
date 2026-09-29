// Reader-friendly names for the seeded units of measure (lkp_unit). A quantity
// on its own — "Ordered 30" — doesn't say whether that's 30 pieces or 30 square
// feet, so screens show the unit beside it. Units are a fixed, read-only
// vocabulary (services/inventoryLookupService), so a static map is safe; an
// unrecognised code is shown as it is.
const UNIT_LABELS: Record<string, string> = {
  EA: 'Each',
  BOX: 'Box',
  SET: 'Set',
  PLT: 'Pallet',
  SLAB: 'Slab',
  SQFT: 'Sq ft',
  SQM: 'Sq m',
  LFT: 'Lin ft',
  KG: 'kg',
  LB: 'lb',
};

/** "SQFT" → "Sq ft", "EA" → "Each"; empty for a blank code. */
export function unitLabel(code: string | null | undefined): string {
  if (!code) return '';
  return UNIT_LABELS[code.trim().toUpperCase()] ?? code;
}
