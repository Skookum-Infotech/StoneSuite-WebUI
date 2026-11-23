// Receiving the slabs a purchase order already put on order.
//
// Sending a purchase order puts one slab per ordered slab into Inventory as
// "On Order" (backend inventory/on_order.go). On the Receive Items page those
// slabs are listed under their line with a checkbox each; ticking a slab says it
// arrived, and posting the receipt turns exactly the ticked slabs into available
// stock. A ticked slab keeps its serial and the size it was ordered at, so the
// only things the receiver adds are a thickness (when the order left it out) and
// an optional bin, chosen slab by slab (or for all the ticked ones at once).
//
// The server recomputes every area and re-checks every slab; what's here mirrors
// it so the form can show the line's quantity before anything is saved.
import type { ItemReceiptLineSlab, ItemReceiptSlabInput, OnOrderSlab } from '@/types/itemReceipt';
import { slabArea } from '@/lib/itemReceiptSlabs';

/** One row of the arrival checklist: an On Order slab and whether it is ticked. */
export interface OnOrderSlabDraft {
  /** The On Order slab's uuid — what the create/update payload names it by. */
  id: string;
  serial: string;
  lengthMm: number;
  widthMm: number;
  /** The thickness the order stated, in millimetres; 0 when it left it out. */
  orderedThicknessMm: number;
  /** The thickness to receive the slab with, in millimetres, as text while the
   *  receiver types. Seeded from the order's; only read by the server when the
   *  order stated none. */
  thicknessMm: string;
  arrived: boolean;
  /** The bin the slab goes into when it arrives (a bin uuid); blank = not binned
   *  yet. Each slab has its own, because one delivery can be spread over bins. */
  binId: string;
}

function num(raw: string): number {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/** The checklist rows for one purchase-order line. `claimed` is the slabs a saved
 *  (pending) receipt has already ticked, which come back ticked, with the
 *  thickness that receipt chose. */
export function onOrderDraftsForLine(
  slabs: readonly OnOrderSlab[],
  purchaseOrderItemId: string,
  claimed: readonly ItemReceiptLineSlab[] = [],
): OnOrderSlabDraft[] {
  const claimedById = new Map<string, ItemReceiptLineSlab>();
  for (const s of claimed) if (s.onOrderSlabId) claimedById.set(s.onOrderSlabId, s);

  return slabs
    .filter((s) => s.purchaseOrderItemId === purchaseOrderItemId)
    .map((s) => {
      const saved = claimedById.get(s.id);
      const thickness = saved && saved.thicknessMm > 0 ? saved.thicknessMm : s.thicknessMm;
      return {
        id: s.id,
        serial: s.serial,
        lengthMm: s.lengthMm,
        widthMm: s.widthMm,
        orderedThicknessMm: s.thicknessMm,
        thicknessMm: thickness > 0 ? String(thickness) : '',
        arrived: Boolean(saved),
        binId: saved?.binId ?? '',
      };
    });
}

/** The slabs the receiver has ticked. */
export function arrivedSlabs(drafts: readonly OnOrderSlabDraft[]): OnOrderSlabDraft[] {
  return drafts.filter((d) => d.arrived);
}

/** Ticks or unticks every slab. */
export function setAllArrived(drafts: readonly OnOrderSlabDraft[], arrived: boolean): OnOrderSlabDraft[] {
  return drafts.map((d) => (d.arrived === arrived ? d : { ...d, arrived }));
}

/** Ticks or unticks one slab, touching nothing else. */
export function setArrived(drafts: readonly OnOrderSlabDraft[], id: string, arrived: boolean): OnOrderSlabDraft[] {
  return drafts.map((d) => (d.id === id ? { ...d, arrived } : d));
}

/** Sets the thickness of one slab, touching nothing else. */
export function setThickness(drafts: readonly OnOrderSlabDraft[], id: string, thicknessMm: string): OnOrderSlabDraft[] {
  return drafts.map((d) => (d.id === id ? { ...d, thicknessMm } : d));
}

/** Puts one slab in a bin ('' = no bin), touching nothing else. */
export function setBin(drafts: readonly OnOrderSlabDraft[], id: string, binId: string): OnOrderSlabDraft[] {
  return drafts.map((d) => (d.id === id ? { ...d, binId } : d));
}

/** Puts every ticked slab in one bin; slabs not ticked keep what they had. */
export function setBinForArrived(drafts: readonly OnOrderSlabDraft[], binId: string): OnOrderSlabDraft[] {
  return drafts.map((d) => (d.arrived ? { ...d, binId } : d));
}

/** One slab's area in the line's unit, from the size it was ordered at. */
export function onOrderSlabArea(draft: OnOrderSlabDraft, unitCode: string): number {
  return slabArea(String(draft.lengthMm), String(draft.widthMm), unitCode);
}

/** The area the ticked slabs add up to — the line's received quantity. */
export function arrivedArea(drafts: readonly OnOrderSlabDraft[], unitCode: string): number {
  const AREA_SCALE = 1000;
  const total = arrivedSlabs(drafts).reduce((sum, d) => sum + onOrderSlabArea(d, unitCode), 0);
  return Math.round(total * AREA_SCALE) / AREA_SCALE;
}

/** Why a ticked slab can't be received, or null when it can. */
export function onOrderSlabProblem(draft: OnOrderSlabDraft): string | null {
  if (!draft.arrived) return null;
  return num(draft.thicknessMm) > 0 ? null : `slab ${draft.serial}: thickness must be greater than zero.`;
}

/** The create/update payload row for a ticked slab. */
export function toOnOrderInput(draft: OnOrderSlabDraft): ItemReceiptSlabInput {
  return {
    onOrderSlabId: draft.id,
    lengthMm: draft.lengthMm,
    widthMm: draft.widthMm,
    thicknessMm: num(draft.thicknessMm),
    binId: draft.binId.trim() || undefined,
  };
}

/** "3 of 10 slabs arrived" — the checklist's headline. */
export function arrivalProgressText(arrived: number, total: number): string {
  return `${arrived} of ${total} slab${total === 1 ? '' : 's'} arrived`;
}
