// Draws the active area's notes and manual dimensions, plus the first point of
// a dimension still being placed. Presentational — editing lives in the
// Annotations panel.

import type { Point } from '@/types/drawing';
import { layoutDimension } from '@/lib/drawing/dimensions';
import { useDrawingEditor } from './DrawingEditorContext';
import { DimensionLine } from './DimensionLine';

const NOTE_FONT_SIZE = 14;
const PENDING_RADIUS = 4;

export function AnnotationLayer({ pendingFrom }: { pendingFrom: Point | null }) {
  const { state } = useDrawingEditor();
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
        <text key={n.id} x={n.at.x} y={-n.at.y} fontSize={NOTE_FONT_SIZE} className="fill-brand">{n.text}</text>
      ))}
      {pendingFrom && <circle cx={pendingFrom.x} cy={-pendingFrom.y} r={PENDING_RADIUS} className="fill-brand" />}
    </g>
  );
}
