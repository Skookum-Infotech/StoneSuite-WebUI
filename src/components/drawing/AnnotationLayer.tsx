// Draws the active area's notes and manual dimensions, plus the line being
// drawn right now: its first point, and a rubber band following the cursor.
// Presentational — editing lives in the Annotations panel.

import type { Point } from '@/types/drawing';
import { layoutDimension } from '@/lib/drawing/dimensions';
import { useDrawingEditor } from './DrawingEditorContext';
import { DimensionLine } from './DimensionLine';

const NOTE_FONT_SIZE = 14;
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
      {area.notes.map((n) => (
        <text key={n.id} x={n.at.x} y={-n.at.y} fontSize={px(NOTE_FONT_SIZE)} className="fill-brand">{n.text}</text>
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
