// A review draft can outlive the match it was built from: the server re-matches
// a resumed document against today's customers, items and learned aliases. The
// draft keeps everything the reviewer set; only slots that are still empty take
// the fresh match.
import type { ReviewForm } from '@/hooks/salesOrderReviewTypes';
import type { SalesOrderHandoff } from './salesOrderDocumentHandoff';
import type { SOLineItem } from './salesOrderForm';

/** Fills the draft's empty customer and item-less lines from a fresh handoff.
 *  A line is filled only when its quantity and price still equal the fresh
 *  line's — otherwise the reviewer edited it, or the new item converts units,
 *  and copying the item alone would mix units. */
export function fillDraftGaps(draft: ReviewForm, handoff: SalesOrderHandoff): ReviewForm {
  const fresh = new Map(handoff.lineItems.map((l) => [l.id, l]));
  const lineItems = draft.lineItems.map((line): SOLineItem => {
    const f = fresh.get(line.id);
    if (line.inventoryItemUuid || !f?.inventoryItemUuid) return line;
    if (f.quantity !== line.quantity || f.unitPrice !== line.unitPrice) return line;
    return { ...line, inventoryItemUuid: f.inventoryItemUuid, itemName: f.itemName, itemSku: f.itemSku, units: f.units };
  });
  return { ...draft, customer: draft.customer ?? handoff.customer.resolved, lineItems };
}
