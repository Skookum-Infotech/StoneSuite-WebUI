import { lineReviewKey, type ReviewItem } from '@/lib/documentHandoffShared';
import { VB_HEADER_KEYS, VB_HEADER_LABELS, type BillPurchaseOrderLink } from '@/lib/vendorBillHandoffTypes';
import type { PurchaseLineFields } from '@/lib/purchaseDocumentShared';
import type { CustomerMatch, ExtractionResolution, LinkedPurchaseOrderLine } from '@/types/documentExtraction';

const MILLI = 1000;
const WHITESPACE = /\s+/g;

/** The result of pairing bill lines with the purchase order's lines. */
export interface PoLineLinking {
  /** Bill line id -> the single PO line id it is billed against. */
  links: Record<string, string>;
  /** Bill line id -> PO line ids that fit equally well (the reviewer picks). */
  candidates: Record<string, string[]>;
  items: ReviewItem[];
}

const norm = (s: string): string => s.trim().toLowerCase().replace(WHITESPACE, ' ');

/** Pairs each bill line with a PO line: by inventory item, or by description
 *  when the bill line has no item. Exactly one fit links; two or more (the same
 *  item twice on the order, or an order line already taken) is left for the
 *  reviewer; none leaves the line unlinked. */
export function linkPoLines(fields: PurchaseLineFields[], poLines: LinkedPurchaseOrderLine[]): PoLineLinking {
  const out: PoLineLinking = { links: {}, candidates: {}, items: [] };
  const taken = new Set<string>();
  fields.forEach((f) => {
    const fits = f.inventoryItemUuid
      ? poLines.filter((p) => p.inventoryItemUuid === f.inventoryItemUuid)
      : poLines.filter((p) => !p.inventoryItemUuid && norm(p.description) === norm(f.itemDescription || f.itemName));
    const key = lineReviewKey(f.lineNo);
    const label = `Line ${f.lineNo}`;
    if (fits.length === 1 && !taken.has(fits[0].id)) {
      const po = fits[0];
      out.links[f.id] = po.id;
      taken.add(po.id);
      if ((parseFloat(f.quantity) || 0) > po.billableQtyMilli / MILLI) {
        // The server refuses an over-bill, so this blocks Save until fixed.
        out.items.push({
          key, label, required: true,
          reason: `Billing ${f.quantity} but only ${po.billableQtyMilli / MILLI} of the purchase order line is received and not yet billed - lower the quantity or unlink the PO line.`,
        });
      }
    } else if (fits.length > 0) {
      out.candidates[f.id] = fits.map((p) => p.id);
      const reason = fits.length === 1
        ? 'Another line already bills this purchase order line - pick the PO line, or leave this line unlinked.'
        : 'This line fits more than one purchase order line - pick the PO line.';
      out.items.push({ key, label, required: false, reason });
    }
  });
  return out;
}

/** The purchase order link for a bill: the picker prefill and which PO lines
 *  bill lines may link to. A billable order links its lines; one that cannot be
 *  billed (or whose vendor is not yet confirmed) is only a plain reference at
 *  most; one blanked by the server (another vendor's, not found) links nothing. */
export function buildPoLink(
  res: ExtractionResolution, vendor: CustomerMatch | undefined, fields: PurchaseLineFields[], docPoNumber: string,
): { link: BillPurchaseOrderLink; linking: PoLineLinking; items: ReviewItem[] } {
  const key = VB_HEADER_KEYS.purchaseOrder;
  const label = VB_HEADER_LABELS.purchaseOrder;
  const none = { links: {}, candidates: {}, items: [] } as PoLineLinking;
  const lpo = res.linkedPurchaseOrder;
  const note = (reason: string): ReviewItem => ({ key, label, required: false, reason });
  const emptyLink: BillPurchaseOrderLink = { ref: null, lines: [], candidates: {} };
  if (!lpo?.uuid) {
    const why = lpo?.reason ?? (docPoNumber ? `Purchase order ${docPoNumber} wasn't found for this vendor - pick it, or leave the bill unlinked.` : '');
    return { link: emptyLink, linking: none, items: why ? [note(why)] : [] };
  }
  const ref = { id: lpo.uuid, number: lpo.number ?? docPoNumber };
  if (!vendor?.uuid || !vendor.active) {
    return { link: emptyLink, linking: none, items: [note(`Pick the vendor first, then link purchase order ${ref.number}.`)] };
  }
  if (!lpo.billable) {
    const why = lpo.reason ?? `Purchase order ${ref.number} has nothing received to bill.`;
    return { link: { ref, lines: [], candidates: {} }, linking: none, items: [note(`${why} Kept as a reference only.`)] };
  }
  const lines = lpo.lines ?? [];
  const linking = linkPoLines(fields, lines);
  return { link: { ref, lines, candidates: linking.candidates }, linking, items: linking.items };
}
