// One piece on the canvas: its outline, its label, click-to-select, and
// drag-to-move (snapped to the grid). Keyboard nudge/rotate/delete/
// duplicate live on DrawingCanvas and PieceInspector — this component only
// owns pointer interaction and rendering.
//
// Dragging tracks the pointer in LOCAL state only (dragPreviewPosition) and
// dispatches a single `movePiece` on pointerup — found in the final review
// of this feature: dispatching on every pointermove pushed one undo-history
// entry per move event, filling the 50-step cap in under a second of
// dragging. The pixel->mm conversion also goes through viewport.ts now,
// which corrects for the SVG rendering at any size other than its fixed
// 800x600 viewBox (previously assumed 1 pixel == 1 viewBox unit).

import { useState } from 'react';
import type { Piece, Point } from '@/types/drawing';
import { snapToGrid, transformOutline } from '@/lib/drawing/geometry';
import { GRID_SIZE_MM } from '@/lib/drawing/constants';
import { pixelDeltaToMm } from '@/lib/drawing/viewport';
import { useDrawingEditor } from './DrawingEditorContext';

function centroid(points: Point[]): Point {
  return points.reduce(
    (acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length }),
    { x: 0, y: 0 },
  );
}

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPosition: Point;
}

export function PieceShape({ piece, selected }: { piece: Piece; selected: boolean }) {
  const { state, dispatch, tool } = useDrawingEditor();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [previewPosition, setPreviewPosition] = useState<Point | null>(null);

  const displayPosition = previewPosition ?? piece.position;
  const worldOutline = transformOutline(piece.outline, displayPosition, piece.rotationDeg);
  const points = worldOutline.map((p) => `${p.x},${-p.y}`).join(' ');
  const labelAt = centroid(worldOutline);

  const select = () => dispatch({ type: 'selectPiece', pieceId: piece.id });

  const onPointerDown = (e: React.PointerEvent<SVGGElement>) => {
    if (tool !== 'select') return;
    select();
    setDrag({
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPosition: piece.position,
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
    const prospective = { x: drag.startPosition.x + mmDelta.x, y: drag.startPosition.y + mmDelta.y };
    setPreviewPosition(snapToGrid(prospective, GRID_SIZE_MM));
  };

  const onPointerUp = (e: React.PointerEvent<SVGGElement>) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (previewPosition && (previewPosition.x !== piece.position.x || previewPosition.y !== piece.position.y)) {
      dispatch({
        type: 'movePiece',
        areaId: state.activeAreaId,
        pieceId: piece.id,
        delta: { x: previewPosition.x - piece.position.x, y: previewPosition.y - piece.position.y },
      });
    }
    setDrag(null);
    setPreviewPosition(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select();
    }
  };

  return (
    <g
      tabIndex={0}
      role="button"
      aria-label={`Piece ${piece.label}${selected ? ', selected' : ''}`}
      onClick={() => tool === 'select' && select()}
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
      <text x={labelAt.x} y={-labelAt.y} textAnchor="middle" fontSize={14} className="fill-stone-800 select-none">
        {piece.label}
      </text>
    </g>
  );
}
