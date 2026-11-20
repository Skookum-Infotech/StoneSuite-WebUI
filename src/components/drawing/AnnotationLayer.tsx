// Draws the active area's manual dimensions (its text is TextNoteLayer's), plus the line being
// drawn right now: its first point, a rubber band following the cursor, and a ring where the
// pointer would snap to (a corner, the spot straight across, or a border) — so the user can see
// the click will land on the far side before making it.
// Presentational — editing lives in the Annotations panel.

import type { Point } from '@/types/drawing';
import type { Snap } from '@/lib/drawing/annotationSnap';
import { layoutDimension } from '@/lib/drawing/dimensions';
import { useDrawingEditor } from './DrawingEditorContext';
import { DimensionLine } from './DimensionLine';

const PENDING_RADIUS = 4;
const SNAP_RING_RADIUS = 8;
const SNAP_RING_WIDTH = 2;

export function AnnotationLayer({ pendingFrom, snap }: { pendingFrom: Point | null; snap: Snap | null }) {
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
      {pendingFrom && snap && (
        <line
          x1={pendingFrom.x}
          y1={-pendingFrom.y}
          x2={snap.point.x}
          y2={-snap.point.y}
          className="stroke-brand"
          strokeWidth={px(1.5)}
          strokeDasharray={`${px(6)} ${px(4)}`}
        />
      )}
      {pendingFrom && <circle cx={pendingFrom.x} cy={-pendingFrom.y} r={px(PENDING_RADIUS)} className="fill-brand" />}
      {snap && snap.kind !== 'free' && (
        <circle
          data-testid="snap-ring"
          data-snap={snap.kind}
          cx={snap.point.x}
          cy={-snap.point.y}
          r={px(SNAP_RING_RADIUS)}
          strokeWidth={px(SNAP_RING_WIDTH)}
          className={snap.kind === 'corner' ? 'fill-brand/30 stroke-brand' : 'fill-none stroke-brand'}
        />
      )}
    </g>
  );
}
