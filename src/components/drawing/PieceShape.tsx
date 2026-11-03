// One piece on the canvas: its outline, its label, click-to-select, and
// drag-to-move (snapped to the grid). Keyboard nudge/rotate/delete/
// duplicate live on DrawingCanvas and PieceInspector — this component only
// owns pointer interaction and rendering.

import { useRef } from 'react';
import type { Piece, Point } from '@/types/drawing';
import { snapToGrid, transformOutline } from '@/lib/drawing/geometry';
import { GRID_SIZE_MM } from '@/lib/drawing/constants';
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
  const dragRef = useRef<DragState | null>(null);

  const worldOutline = transformOutline(piece.outline, piece.position, piece.rotationDeg);
  const points = worldOutline.map((p) => `${p.x},${-p.y}`).join(' ');
  const labelAt = centroid(worldOutline);

  const select = () => dispatch({ type: 'selectPiece', pieceId: piece.id });

  const onPointerDown = (e: React.PointerEvent<SVGGElement>) => {
    if (tool !== 'select') return;
    select();
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPosition: piece.position,
    };
    // jsdom (tests) doesn't implement pointer capture on SVG elements; every
    // real browser does.
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dxMm = (e.clientX - drag.startClientX) / state.zoom;
    const dyMm = -(e.clientY - drag.startClientY) / state.zoom; // screen y grows down; world y grows up
    const prospective = { x: drag.startPosition.x + dxMm, y: drag.startPosition.y + dyMm };
    const snapped = snapToGrid(prospective, GRID_SIZE_MM);
    dispatch({
      type: 'movePiece',
      areaId: state.activeAreaId,
      pieceId: piece.id,
      delta: { x: snapped.x - piece.position.x, y: snapped.y - piece.position.y },
    });
  };

  const onPointerUp = (e: React.PointerEvent<SVGGElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
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
