// One piece on the canvas: its outline, its cutouts, its label, click- and
// shift-click selection, and drag-to-move (snapped to the grid, then to
// neighbouring pieces' edges). Keyboard nudge/rotate/delete/duplicate live on
// DrawingCanvas and PieceInspector — this component only owns pointer
// interaction and rendering.
//
// Dragging tracks the pointer in LOCAL state only (previewPosition) and
// dispatches a single `movePieces` on pointerup — dispatching on every
// pointermove would push one undo-history entry per move event, filling the
// 50-step cap in under a second of dragging. Every other piece in the same
// selection follows through DragPreviewContext. The pixel->mm conversion goes
// through viewport.ts, which corrects for the SVG rendering at any size other
// than its fixed 800x600 viewBox.

import { memo, useMemo, useState } from 'react';
import type { Piece, Point } from '@/types/drawing';
import { centroid, snapToGrid, transformOutline } from '@/lib/drawing/geometry';
import { GRID_SIZE_MM, MIN_DRAG_MM, SNAP_TOLERANCE_MM } from '@/lib/drawing/constants';
import { validateCutouts } from '@/lib/drawing/cutouts';
import { snapNudge } from '@/lib/drawing/snapping';
import { pixelDeltaToMm } from '@/lib/drawing/viewport';
import { CutoutShape } from './CutoutShape';
import { useDragPreview } from './DragPreviewContext';
import { useDrawingEditor } from './DrawingEditorContext';

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPosition: Point;
  movingIds: string[];
}

function PieceShapeBase({ piece, selected }: { piece: Piece; selected: boolean }) {
  const { state, dispatch, tool } = useDrawingEditor();
  const { preview, setPreview } = useDragPreview();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [previewPosition, setPreviewPosition] = useState<Point | null>(null);

  // Another piece in the same selection is being dragged: follow it.
  const followDelta = !drag && preview?.pieceIds.includes(piece.id) ? preview.delta : null;
  const displayPosition = previewPosition
    ?? (followDelta ? { x: piece.position.x + followDelta.x, y: piece.position.y + followDelta.y } : piece.position);
  const worldOutline = transformOutline(piece.outline, displayPosition, piece.rotationDeg);
  const points = worldOutline.map((p) => `${p.x},${-p.y}`).join(' ');
  const labelAt = centroid(worldOutline);
  const invalidCutoutIds = useMemo(
    () => new Set(validateCutouts(piece).flatMap((issue) => (issue.otherId ? [issue.cutoutId, issue.otherId] : [issue.cutoutId]))),
    [piece],
  );

  const select = (additive: boolean) => dispatch({ type: 'selectPiece', pieceId: piece.id, additive });

  const onPointerDown = (e: React.PointerEvent<SVGGElement>) => {
    if (tool !== 'select') return;
    if (e.shiftKey) {
      select(true);
      return;
    }
    select(false);
    const inGroup = state.selectedPieceIds.length > 1 && state.selectedPieceIds.includes(piece.id);
    setDrag({
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPosition: piece.position,
      movingIds: inGroup ? state.selectedPieceIds : [piece.id],
    });
    // jsdom (tests) doesn't implement pointer capture on SVG elements; every
    // real browser does.
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<SVGGElement>) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mmDelta = pixelDeltaToMm(e.clientX - drag.startClientX, e.clientY - drag.startClientY, rect, state.zoom);
    const gridded = snapToGrid(
      { x: drag.startPosition.x + mmDelta.x, y: drag.startPosition.y + mmDelta.y },
      GRID_SIZE_MM,
    );
    // Then pull the piece flush against a neighbour's edge or corner if one is close.
    const others = (state.present.areas.find((a) => a.id === state.activeAreaId)?.pieces ?? [])
      .filter((p) => !drag.movingIds.includes(p.id))
      .map((p) => transformOutline(p.outline, p.position, p.rotationDeg));
    const nudge = snapNudge(transformOutline(piece.outline, gridded, piece.rotationDeg), others, SNAP_TOLERANCE_MM);
    const next = { x: gridded.x + nudge.x, y: gridded.y + nudge.y };
    setPreviewPosition(next);
    setPreview({
      pieceIds: drag.movingIds.filter((id) => id !== piece.id),
      delta: { x: next.x - drag.startPosition.x, y: next.y - drag.startPosition.y },
    });
  };

  const onPointerUp = (e: React.PointerEvent<SVGGElement>) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (previewPosition) {
      const delta = { x: previewPosition.x - piece.position.x, y: previewPosition.y - piece.position.y };
      if (Math.abs(delta.x) > MIN_DRAG_MM || Math.abs(delta.y) > MIN_DRAG_MM) {
        dispatch({ type: 'movePieces', areaId: state.activeAreaId, pieceIds: drag.movingIds, delta });
      }
    }
    setDrag(null);
    setPreviewPosition(null);
    setPreview(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(e.shiftKey);
    }
  };

  return (
    <g
      tabIndex={0}
      role="button"
      aria-label={`Piece ${piece.label}${selected ? ', selected' : ''}`}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="cursor-move outline-none"
    >
      <polygon
        points={points}
        className={selected ? 'fill-brand/20 stroke-brand' : 'fill-stone-100 stroke-stone-400'}
        strokeWidth={selected ? 2 : 1}
      />
      {/* Local coordinates -> screen: position, then rotation, then the
          y-flip every world point gets on its way to SVG. */}
      <g transform={`translate(${displayPosition.x},${-displayPosition.y}) rotate(${piece.rotationDeg}) scale(1,-1)`}>
        {piece.cutouts.map((cutout) => (
          <CutoutShape
            key={cutout.id}
            piece={piece}
            cutout={cutout}
            selected={selected && state.selectedCutoutId === cutout.id}
            invalid={invalidCutoutIds.has(cutout.id)}
          />
        ))}
      </g>
      <text x={labelAt.x} y={-labelAt.y} textAnchor="middle" fontSize={14} className="fill-stone-800 select-none">
        {piece.label}
      </text>
    </g>
  );
}

// Pieces re-render with the drag preview, but memo stops them re-rendering when
// the canvas re-renders for any other reason (selection of a different piece, pan).
export const PieceShape = memo(PieceShapeBase);
