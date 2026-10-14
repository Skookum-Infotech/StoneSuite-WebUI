// Display helpers for the Created Orders list. Kept out of the form logic so the
// list page and the form can change independently.

/** "pending_review" → "Pending review". The server owns the status vocabulary,
 *  so an unknown value is shown readably rather than mapped or dropped. */
export function orderStatusLabel(status: string): string {
  const words = status.trim().replace(/[_-]+/g, ' ');
  if (words === '') return 'Submitted';
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

/** "1 area" / "3 areas" — the list's Areas column. */
export function areaCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'area' : 'areas'}`;
}

/** The "Install Address" cell's second line: "City, ZIP" with whichever parts
 *  exist, or '' when neither does. */
export function cityZipLabel(city: string, zip: string): string {
  return [city.trim(), zip.trim()].filter((part) => part !== '').join(', ');
}
