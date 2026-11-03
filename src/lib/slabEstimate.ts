/** A whole, positive slab count for the payload, or undefined when the field is
 *  blank or not a valid count. */
export function toExpectedSlabs(raw: string | undefined | null): number | undefined {
  const n = parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
