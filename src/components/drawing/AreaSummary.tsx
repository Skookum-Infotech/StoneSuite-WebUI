// Footer: piece count and sq ft for the active area, plus the sq ft total
// across the whole drawing. The headline figure is the gross outline area.
// When cutouts exist, the net surface (outline minus openings) is shown next
// to it — that is the finished surface, not how much slab will be used, which
// depends on layout, kerf and waste.

import { areaMetrics, drawingMetrics, mm2ToSqFt } from '@/lib/drawing/metrics';
import { useDrawingEditor } from './DrawingEditorContext';

function roundSqFt(mm2: number): number {
  return Math.round(mm2ToSqFt(mm2) * 10) / 10;
}

export function AreaSummary() {
  const { state } = useDrawingEditor();
  const activeArea = state.present.areas.find((a) => a.id === state.activeAreaId);
  const active = areaMetrics(activeArea?.pieces ?? []);
  const total = drawingMetrics(state.present.areas);

  return (
    <div className="flex flex-wrap gap-x-4 text-xs text-stone-600">
      <span>{active.pieceCount} pieces</span>
      <span>{roundSqFt(active.grossAreaMm2)} sq ft</span>
      <span>{roundSqFt(total.grossAreaMm2)} sq ft total</span>
      {active.cutoutCount > 0 && (
        <span title="Net surface = outline minus cutouts. It is not slab consumption.">
          {active.cutoutCount} cutouts · net {roundSqFt(active.netAreaMm2)} sq ft
        </span>
      )}
    </div>
  );
}
