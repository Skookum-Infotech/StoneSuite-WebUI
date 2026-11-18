// Draws the active area's manual dimensions (its text is TextNoteLayer's), plus the line being
// drawn right now: its first point, and a rubber band following the cursor.
// Presentational — editing lives in the Annotations panel.

import type { Point } from '@/types/drawing';
import { layoutDimension } from '@/lib/drawing/dimensions';
import { useDrawingEditor } from './DrawingEditorContext';
import { DimensionLine } from './DimensionLine';

const PENDING_RADIUS = 4;

export function AnnotationLayer({ pendingFrom, hoverPoint }: { pendingFrom: Point | null; hoverPoint: Point | null }) {
  const { state } = useDrawingEditor();
  // Constant on-screen size at any zoom — see DimensionLine.
  const px = (value: number) => value / state.zoom;
  const area = state.present.areas.find((a) => a.id === state.activeAreaId);
  const { displayUnit, fractionDenominator } = state.present;
  if (!area) return null;
  return (
    <g aria-hidden="true" pointerEvents="none">
      {(area.dimensions ?? []).map((d) => (
        <DimensionLine
          key={d.id}
          layout={layoutDimension(d.from, d.to, d.offsetMm)}
          displayUnit={displayUnit}
          fractionDenominator={fractionDenominator}
        />
      ))}
      {pendingFrom && hoverPoint && (
        <line
          x1={pendingFrom.x}
          y1={-pendingFrom.y}
          x2={hoverPoint.x}
          y2={-hoverPoint.y}
          className="stroke-brand"
          strokeWidth={px(1.5)}
          strokeDasharray={`${px(6)} ${px(4)}`}
        />
      )}
      {pendingFrom && <circle cx={pendingFrom.x} cy={-pendingFrom.y} r={px(PENDING_RADIUS)} className="fill-brand" />}
    </g>
  );
}
