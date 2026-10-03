const FOCUSABLE = 'input, button, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

/** Moves focus to the review row for a field key (its first focusable control,
 *  or the row itself) and scrolls it into view. Returns whether a row was found. */
export function focusReviewTarget(key: string, reduceMotion = false): boolean {
  const row = Array.from(document.querySelectorAll<HTMLElement>('[data-review-row]'))
    .find((el) => el.dataset.reviewRow === key);
  if (!row) return false;
  const target = row.querySelector<HTMLElement>(FOCUSABLE) ?? row;
  row.scrollIntoView?.({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  target.focus();
  return true;
}
