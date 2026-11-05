// Footer: piece count and sq ft for the active area, plus the sq ft total
// across the whole drawing (build spec Task 3). squareFeet is computed on
// each piece's own `outline` — never the transformed/world outline —
// since translation and 90° rotation never change area.

import { squareFeet } from '@/lib/drawing/geometry';
import { useDrawingEditor } from './DrawingEditorContext';

function roundSqFt(mm2SqFt: number): number {
  return Math.round(mm2SqFt * 10) / 10;
}

export function AreaSummary() {
  const { state } = useDrawingEditor();
  const activeArea = state.present.areas.find((a) => a.id === state.activeAreaId);
  const activeAreaSqFt = roundSqFt((activeArea?.pieces ?? []).reduce((sum, p) => sum + squareFeet(p.outline), 0));
  const totalSqFt = roundSqFt(
    state.present.areas.reduce((sum, area) => sum + area.pieces.reduce((s, p) => s + squareFeet(p.outline), 0), 0),
  );

  return (
    <div className="flex gap-4 text-xs text-stone-600">
      <span>{activeArea?.pieces.length ?? 0} pieces</span>
      <span>{activeAreaSqFt} sq ft</span>
      <span>{totalSqFt} sq ft total</span>
    </div>
  );
}
