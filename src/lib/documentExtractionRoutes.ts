/** Where a create-from-document flow lands (Sales Order only in v1). */
export const SALES_ORDER_NEW_PATH = '/sales/sales_order/new';

/** The review route for a ready extraction. */
export function fromDocumentPath(extractionId: string): string {
  return `${SALES_ORDER_NEW_PATH}?fromDocument=${encodeURIComponent(extractionId)}`;
}

/** Detail route of an existing sales order. */
export function salesOrderPath(recordUuid: string): string {
  return `/sales/sales_order/${recordUuid}`;
}

/** Duplicate kinds that should stop and ask before opening the review form. The
 *  quote/estimate references are informational and don't gate it. */
export const BLOCKING_DUPLICATE_KINDS: ReadonlySet<string> = new Set(['same_file', 'same_po', 'revision']);
