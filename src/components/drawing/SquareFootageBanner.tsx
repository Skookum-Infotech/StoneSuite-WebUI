// Warns when the drawing's actual sq ft for a material line diverges from
// that line's own quantity (build spec §5 Task 5), so staff notice before
// invoicing off a stale line quantity. Only lines pieces are actually
// assigned to (via salesOrderLineId) and whose unit is area-denominated are
// ever compared — a line in "each" or similar is never flagged.

import { useState } from 'react';
import { materialUsage } from '@/lib/drawing/materials';
import { mm2ToSqFt } from '@/lib/drawing/metrics';
import { fromOrder, toCreatePayload } from '@/lib/salesOrderForm';
import { salesOrderService } from '@/services/salesOrderService';
import type { DrawingArea } from '@/types/drawing';
import type { SalesOrder } from '@/types/salesOrder';

const AREA_UNIT_CODE = 'SQFT';
const SQ_FT_MISMATCH_TOLERANCE = 0.1;

interface LineMismatch {
  lineId: string;
  lineNumber: number;
  drawingSqFt: number;
  lineSqFt: number;
}

function computeMismatches(areas: DrawingArea[], lines: SalesOrder['items']): LineMismatch[] {
  // Outline area plus backsplash / waterfall panels (see materials.ts).
  const sqFtByLine = new Map<string, number>();
  for (const usage of materialUsage(areas)) {
    if (usage.lineId) sqFtByLine.set(usage.lineId, mm2ToSqFt(usage.billableAreaMm2));
  }
  const mismatches: LineMismatch[] = [];
  for (const [lineId, drawingSqFt] of sqFtByLine) {
    const line = lines.find((l) => l.id === lineId);
    if (!line || line.unitCode !== AREA_UNIT_CODE) continue;
    if (Math.abs(drawingSqFt - line.quantity) > SQ_FT_MISMATCH_TOLERANCE) {
      mismatches.push({ lineId, lineNumber: line.lineNumber, drawingSqFt, lineSqFt: line.quantity });
    }
  }
  return mismatches;
}

export function SquareFootageBanner({ areas, order, onLineUpdated }: {
  areas: DrawingArea[]; order: SalesOrder; onLineUpdated: (order: SalesOrder) => void;
}) {
  const [updatingLineId, setUpdatingLineId] = useState<string | null>(null);
  const mismatches = computeMismatches(areas, order.items);

  if (mismatches.length === 0) return null;

  const updateLine = async (lineId: string, lineNumber: number, newSqFt: number) => {
    setUpdatingLineId(lineId);
    try {
      const { data, lineItems } = fromOrder(order);
      // fromOrder gives every line a synthetic `existing-<index>` id (its
      // own form-state concept, unrelated to the server's real line id) —
      // lineNumber is what actually round-trips, so match on that instead.
      const updated = lineItems.map((item) => (item.lineNo === lineNumber ? { ...item, quantity: String(newSqFt) } : item));
      const payload = toCreatePayload(data, updated, order.customFields ?? {});
      const saved = await salesOrderService.updateOrder(order.id, payload);
      onLineUpdated(saved);
    } finally {
      setUpdatingLineId(null);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {mismatches.map((m) => (
        <div key={m.lineId} role="status" className="flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
          <span>
            Drawing {m.drawingSqFt.toFixed(1)} sq ft vs line {m.lineSqFt.toFixed(1)} sq ft
          </span>
          <button
            type="button"
            aria-label={`Update line ${m.lineNumber} quantity to match the drawing`}
            disabled={updatingLineId === m.lineId}
            onClick={() => updateLine(m.lineId, m.lineNumber, m.drawingSqFt)}
            className="font-semibold underline disabled:opacity-50"
          >
            Update line
          </button>
        </div>
      ))}
    </div>
  );
}
