// One slab with the pieces laid on it: the photo (or plain stone) at true proportions,
// and each placed piece's outline on top — light blue where it fits, red where it
// runs off the slab or overlaps another piece. Drag an outline to move it; the
// arrow keys nudge it, R turns it, Delete takes it off the slab.
//
// Dragging tracks the pointer in local state and dispatches once on release, the
// same way PieceShape does, so one drag is one undo step.

import { useMemo, useState } from 'react';
import { RotateCw, Trash2 } from 'lucide-react';
import type { Piece, SlabPlacement } from '@/types/drawing';
import type { DrawingSlabUnit } from '@/types/drawingSlab';
import {
  SLAB_NUDGE_MM, placedOutline, rotatedPlacement, slabFit, type SlabFit,
} from '@/lib/drawing/slabs';
import { cn } from '@/lib/utils';
import { useDrawingEditor } from './DrawingEditorContext';

/** The slab's length is divided by this to size piece labels, so they read the same on any slab. */
const LABEL_DIVISOR = 45;
const KEY_ROTATE = 'r';

interface Placed {
  areaId: string;
  piece: Piece;
  placement: SlabPlacement;
}

interface DragState {
  pieceId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  start: SlabPlacement;
  current: SlabPlacement;
}

const FIT_CLASSES: Record<SlabFit, string> = {
  fits: 'fill-sky-300/40 stroke-sky-500',
  outside: 'fill-red-500/30 stroke-red-600',
  overlap: 'fill-red-500/30 stroke-red-600',
};

const FIT_LABELS: Record<SlabFit, string> = {
  fits: 'fits',
  outside: 'runs off the slab',
  overlap: 'overlaps another piece',
};

export function SlabCanvas({ slab }: { slab: DrawingSlabUnit }) {
  const { state, dispatch } = useDrawingEditor();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const placed = useMemo<Placed[]>(
    () => state.present.areas.flatMap((area) => area.pieces.flatMap((piece) => (
      piece.slab?.slabId === slab.id ? [{ areaId: area.id, piece, placement: piece.slab }] : []
    ))),
    [state.present.areas, slab.id],
  );

  // What is drawn: the dragged piece at its preview spot, the rest as saved. Each
  // piece is checked against the others as drawn, so neighbours react live to a drag.
  const shown = placed.map((p) => (drag?.pieceId === p.piece.id ? { ...p, placement: drag.current } : p));
  const liveFit = (target: Placed): SlabFit => {
    const others = shown.filter((p) => p.piece.id !== target.piece.id).map((p) => placedOutline(p.piece, p.placement));
    return slabFit(placedOutline(target.piece, target.placement), slab, others);
  };
  const selected = shown.find((p) => p.piece.id === selectedId) ?? null;
  const labelSize = slab.lengthMm / LABEL_DIVISOR;

  function commit(target: Placed, placement: SlabPlacement | undefined) {
    dispatch({ type: 'updatePiece', areaId: target.areaId, pieceId: target.piece.id, patch: { slab: placement } });
  }

  function onPointerDown(e: React.PointerEvent<SVGGElement>, target: Placed) {
    setSelectedId(target.piece.id);
    setDrag({
      pieceId: target.piece.id, pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY,
      start: target.placement, current: target.placement,
    });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<SVGGElement>) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dx = ((e.clientX - drag.startClientX) * slab.lengthMm) / rect.width;
    const dy = ((e.clientY - drag.startClientY) * slab.widthMm) / rect.height;
    setDrag({ ...drag, current: { ...drag.start, x: Math.round(drag.start.x + dx), y: Math.round(drag.start.y + dy) } });
  }

  function onPointerUp(e: React.PointerEvent<SVGGElement>, target: Placed) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const moved = drag.current.x !== drag.start.x || drag.current.y !== drag.start.y;
    setDrag(null);
    if (moved) commit(target, drag.current);
  }

  function nudge(target: Placed, dx: number, dy: number) {
    commit(target, { ...target.placement, x: target.placement.x + dx, y: target.placement.y + dy });
  }

  function onKeyDown(e: React.KeyboardEvent<SVGGElement>, target: Placed) {
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-SLAB_NUDGE_MM, 0], ArrowRight: [SLAB_NUDGE_MM, 0], ArrowUp: [0, -SLAB_NUDGE_MM], ArrowDown: [0, SLAB_NUDGE_MM],
    };
    if (arrows[e.key]) {
      e.preventDefault();
      nudge(target, ...arrows[e.key]);
    } else if (e.key.toLowerCase() === KEY_ROTATE) {
      e.preventDefault();
      commit(target, rotatedPlacement(target.placement));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      commit(target, undefined);
      setSelectedId(null);
    }
  }

  const badCount = shown.filter((p) => liveFit(p) !== 'fits').length;

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${slab.lengthMm} ${slab.widthMm}`}
        role="group"
        aria-label={`Slab ${slab.serial} with ${shown.length} piece${shown.length === 1 ? '' : 's'}`}
        className="block h-auto w-full touch-none rounded border border-stone-300 bg-stone-200"
        onPointerDown={(e) => e.target === e.currentTarget && setSelectedId(null)}
      >
        {slab.photoUrl ? (
          <image href={slab.photoUrl} x={0} y={0} width={slab.lengthMm} height={slab.widthMm} preserveAspectRatio="none" />
        ) : (
          <rect x={0} y={0} width={slab.lengthMm} height={slab.widthMm} className="fill-stone-300" />
        )}
        {shown.map((p) => {
          const outline = placedOutline(p.piece, p.placement);
          const fit = liveFit(p);
          const xs = outline.map((pt) => pt.x);
          const ys = outline.map((pt) => pt.y);
          const centre = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
          return (
            <g
              key={p.piece.id}
              tabIndex={0}
              role="button"
              aria-label={`Piece ${p.piece.label} on slab ${slab.serial}, ${FIT_LABELS[fit]}`}
              aria-pressed={selectedId === p.piece.id}
              onPointerDown={(e) => onPointerDown(e, p)}
              onPointerMove={onPointerMove}
              onPointerUp={(e) => onPointerUp(e, p)}
              onKeyDown={(e) => onKeyDown(e, p)}
              className="cursor-move outline-none"
            >
              <polygon
                points={outline.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                strokeWidth={selectedId === p.piece.id ? 3 : 2}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                className={cn(FIT_CLASSES[fit])}
              />
              <text
                x={centre.x}
                y={centre.y}
                fontSize={labelSize}
                textAnchor="middle"
                dominantBaseline="central"
                className="pointer-events-none select-none fill-stone-900 font-semibold"
              >
                {p.piece.label}
              </text>
            </g>
          );
        })}
      </svg>

      {shown.length > 0 && (
        <p role="status" className={cn('text-2xs', badCount > 0 ? 'font-medium text-red-600' : 'text-stone-500')}>
          {badCount > 0
            ? `${badCount} piece${badCount === 1 ? ' does' : 's do'} not fit here. Move ${badCount === 1 ? 'it' : 'them'} or try another slab.`
            : `${shown.length} piece${shown.length === 1 ? '' : 's'} on this slab, all fit.`}
        </p>
      )}

      {selected && (
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-2xs text-stone-600">
            {selected.piece.label}: {FIT_LABELS[liveFit(selected)]}
          </span>
          <button
            type="button"
            aria-label={`Rotate piece ${selected.piece.label} a quarter turn`}
            title="Rotate 90° (R)"
            onClick={() => commit(selected, rotatedPlacement(selected.placement))}
            className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-2xs font-medium text-stone-700 hover:bg-stone-50"
          >
            <RotateCw className="size-3" aria-hidden="true" /> Rotate
          </button>
          <button
            type="button"
            aria-label={`Take piece ${selected.piece.label} off this slab`}
            title="Take off the slab (Delete)"
            onClick={() => { commit(selected, undefined); setSelectedId(null); }}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-2xs font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3" aria-hidden="true" /> Remove
          </button>
        </div>
      )}
    </div>
  );
}
