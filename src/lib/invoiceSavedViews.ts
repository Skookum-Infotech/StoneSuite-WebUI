// What a saved Invoices view remembers: the search and the sort. The list has no
// filter drawer or column picker yet, so there is nothing else to keep.

/** The fields the Invoices list can sort by. */
export const INVOICE_SORT_FIELDS = ['createdAt', 'invoiceDate', 'grandTotal', 'balanceDue'] as const;
export type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number];
export type InvoiceSortDir = 'asc' | 'desc';

/** Page key the views are stored under. */
export const INVOICE_VIEWS_PAGE = 'invoices';

export interface InvoiceViewState {
  term: string;
  sortBy: InvoiceSortField;
  sortDir: InvoiceSortDir;
}

/** Whether a stored value is exactly an InvoiceViewState; anything else is ignored. */
export function isInvoiceViewState(value: unknown): value is InvoiceViewState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.term === 'string' &&
    typeof v.sortBy === 'string' && (INVOICE_SORT_FIELDS as readonly string[]).includes(v.sortBy) &&
    (v.sortDir === 'asc' || v.sortDir === 'desc')
  );
}

/** Whether two views describe the same screen (search compared as typed, trimmed). */
export function sameInvoiceView(a: InvoiceViewState, b: InvoiceViewState): boolean {
  return a.term.trim() === b.term.trim() && a.sortBy === b.sortBy && a.sortDir === b.sortDir;
}
