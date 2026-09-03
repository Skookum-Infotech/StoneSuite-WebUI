// Pure helpers for the Purchases & requisitions status dashboard widget
// (PurchasesStatus). Exactly one of a row's daysOverdue/daysWaiting is ever
// set (see types/dashboardData.ts's PurchasesAttentionRow) -- an overdue
// receipt (a promise already broken) or a pending approval (a promise not
// yet made), never both.
import type { PurchasesAttentionRow } from '@/types/dashboardData';

/** "3 days overdue" / "waiting 6 days" -- the row's own detail line. */
export function formatAttentionDetail(row: PurchasesAttentionRow): string {
  if (row.daysOverdue !== null) {
    return row.daysOverdue === 1 ? '1 day overdue' : `${row.daysOverdue} days overdue`;
  }
  if (row.daysWaiting !== null) {
    if (row.daysWaiting <= 0) return 'waiting less than a day';
    return row.daysWaiting === 1 ? 'waiting 1 day' : `waiting ${row.daysWaiting} days`;
  }
  return '';
}

/** Route to an attention row's own detail page -- purchase orders and
 * requisitions live under different URLs (see router/index.tsx). */
export function attentionRowHref(row: PurchasesAttentionRow): string {
  return row.kind === 'purchase_order' ? `/purchases/purchase_order/${row.id}` : `/purchases/requisition/${row.id}`;
}

/** Record-type chip label shown next to each attention row. */
export function attentionKindLabel(row: PurchasesAttentionRow): string {
  return row.kind === 'purchase_order' ? 'PO' : 'REQ';
}
