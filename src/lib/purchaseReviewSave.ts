import type { HandoffParty } from '@/lib/documentHandoffShared';

// Pure helpers shared by the Purchase Order and Vendor Bill review saves.

/** "We'll remember <doc text> -> <name> next time" when the reviewer chose a
 *  vendor other than the one the server resolved; '' otherwise. */
export function learnedVendorNote(vendor: HandoffParty, chosen: { id: string; name: string } | null): string {
  const doc = vendor.extractedText.trim();
  if (!chosen || !doc) return '';
  if (vendor.resolved?.id === chosen.id) return '';
  return `We'll remember ${doc} → ${chosen.name} next time.`;
}

interface DraftLine {
  id: string;
  quantity: string;
  unitPrice: string;
  itemName: string;
  itemSku?: string;
  units?: string;
  inventoryItemUuid?: string;
}

/** Fills a resumed draft's empty vendor and item-less lines from a fresh
 *  handoff. A line is filled only when its quantity and price still equal the
 *  fresh line's - otherwise the reviewer edited it, or the new item converts
 *  units, and copying the item alone would mix units. */
export function fillPurchaseDraftGaps<L extends DraftLine, F extends { vendor: { id: string; name: string } | null; lineItems: L[] }>(
  draft: F, handoff: { vendor: HandoffParty; lineItems: L[] },
): F {
  const fresh = new Map(handoff.lineItems.map((l) => [l.id, l]));
  const lineItems = draft.lineItems.map((line): L => {
    const f = fresh.get(line.id);
    if (line.inventoryItemUuid || !f?.inventoryItemUuid) return line;
    if (f.quantity !== line.quantity || f.unitPrice !== line.unitPrice) return line;
    return { ...line, inventoryItemUuid: f.inventoryItemUuid, itemName: f.itemName, itemSku: f.itemSku, units: f.units };
  });
  return { ...draft, vendor: draft.vendor ?? handoff.vendor.resolved, lineItems };
}
