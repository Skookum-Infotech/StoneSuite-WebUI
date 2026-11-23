// Auto-numbered, unique, editable piece labels ("A-1", "B-3", ...). Seam
// sub-labels ("A-3.1") and group labels ("Kit 1 of 3") are build spec
// Task 4 (seams don't exist yet) — not built here.

/** Maps an area's index (its position in `Drawing.areas`) to its letter
 *  prefix: 0 -> 'A', 1 -> 'B', ... Spec caps a drawing at 20 areas, so this
 *  never needs to wrap past 'Z'. */
export function areaLetter(areaIndex: number): string {
  return String.fromCharCode(65 + areaIndex);
}

/** The letter shown against one side of a piece in the dimension labels and
 *  the shop drawing: 0 -> 'A', 25 -> 'Z', 26 -> 'AA'. Pieces with more than
 *  26 sides are rare but must not collide. */
export function edgeLetter(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** The next free `${prefix}-${n}` label in an area: the smallest positive
 *  integer `n` not already present in `existingLabels`. */
export function nextPieceLabel(prefix: string, existingLabels: string[]): string {
  let n = 1;
  while (existingLabels.includes(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

/** Validates a piece label a user is typing into the inspector.
 *  `excludeLabel` is the piece's own current label, so re-typing it
 *  unchanged is not treated as a duplicate. Returns an error message, or
 *  `null` when the label is valid. */
export function validatePieceLabel(
  label: string,
  existingLabels: string[],
  excludeLabel?: string,
): string | null {
  if (!label.trim()) return 'Enter a label.';
  const match = existingLabels.find(
    (existing) => existing !== excludeLabel && existing.toLowerCase() === label.toLowerCase(),
  );
  return match ? `${match} is already used in this area.` : null;
}
