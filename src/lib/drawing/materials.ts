// Material quantities grouped by the sales-order line each piece is assigned
// to. No prices here — only areas, which the order line's quantity can be
// checked against.
//
// "Billable" area is the outline area (cutouts are NOT deducted — the stone
// is bought and cut as a whole) plus any backsplash and waterfall panels.
// It is a quantity to compare with the order line, not a slab-consumption
// figure: layout, kerf and waste are not modelled.

import type { DrawingArea } from '@/types/drawing';
import { pieceMetrics } from './metrics';

export interface MaterialUsage {
  /** Sales-order line id, or null for pieces with no material line. */
  lineId: string | null;
  pieceCount: number;
  grossAreaMm2: number;
  /** Backsplash plus waterfall panels. */
  verticalAreaMm2: number;
  billableAreaMm2: number;
  /** Finished top surface: outline minus openings. */
  netAreaMm2: number;
}

export function materialUsage(areas: DrawingArea[]): MaterialUsage[] {
  const groups = new Map<string | null, MaterialUsage>();
  for (const piece of areas.flatMap((a) => a.pieces)) {
    const key = piece.salesOrderLineId ?? null;
    const m = pieceMetrics(piece);
    const vertical = m.edgeTotals.splashAreaMm2 + m.edgeTotals.waterfallAreaMm2;
    const sum = groups.get(key) ?? {
      lineId: key, pieceCount: 0, grossAreaMm2: 0, verticalAreaMm2: 0, billableAreaMm2: 0, netAreaMm2: 0,
    };
    groups.set(key, {
      lineId: key,
      pieceCount: sum.pieceCount + 1,
      grossAreaMm2: sum.grossAreaMm2 + m.grossAreaMm2,
      verticalAreaMm2: sum.verticalAreaMm2 + vertical,
      billableAreaMm2: sum.billableAreaMm2 + m.grossAreaMm2 + vertical,
      netAreaMm2: sum.netAreaMm2 + m.netAreaMm2,
    });
  }
  // Assigned lines first, in first-seen order; unassigned pieces last.
  return [...groups.values()].sort((a, b) => Number(a.lineId === null) - Number(b.lineId === null));
}
