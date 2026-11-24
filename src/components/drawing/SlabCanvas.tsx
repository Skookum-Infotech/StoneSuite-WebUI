// One slab with the pieces (and profile pieces — a painted Profiles side can
// be laid on a slab of its own, lib/drawing/slabPlaceables.ts) laid on it:
// the photo (or plain stone) at true proportions, and each placed item's
// outline on top — light blue where it fits, red where it runs off the slab
// or overlaps another item. Drag an outline to move it; the arrow keys nudge
// it, R turns it, Delete takes it off the slab.
//
// Dragging tracks the pointer in local state and dispatches once on release, the
// same way PieceShape does, so one drag is one undo step.

import { useMemo, useState } from 'react';
import { RotateCw, Trash2 } from 'lucide-react';
import type { SlabPlacement } from '@/types/drawing';
import type { DrawingSlabUnit } from '@/types/drawingSlab';
import {
  SLAB_NUDGE_MM, placedOutline, rotatedPlacement, slabFit, type SlabFit,
} from '@/lib/drawing/slabs';
import { slabPlaceables, type SlabPlaceable } from '@/lib/drawing/slabPlaceables';
import { cn } from '@/lib/utils';
import { useAttachedProfileTypeList } from './AttachedProfileTypesContext';
import { useDrawingEditor } from './DrawingEditorContext';

import { buttonVariants } from '@/components/ui/button';
/** The slab's length is divided by this to size piece labels, so they read the same on any slab. */
const LABEL_DIVISOR = 45;
const KEY_ROTATE = 'r';

interface Placed {
  item: SlabPlaceable;
  placement: SlabPlacement;
}

interface DragState {
  id: string;
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
  const profileTypes = useAttachedProfileTypeList();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const placed = useMemo<Placed[]>(
    () => slabPlaceables(state.present.areas, profileTypes).flatMap((item) => (
      item.slab?.slabId === slab.id ? [{ item, placement: item.slab }] : []
    )),
    [state.present.areas, profileTypes, slab.id],
  );

  // What is drawn: the dragged item at its preview spot, the rest as saved. Each
  // item is checked against the others as drawn, so neighbours react live to a drag.
  const shown = placed.map((p) => (drag?.id === p.item.id ? { ...p, placement: drag.current } : p));
  const liveFit = (target: Placed): SlabFit => {
    const others = shown.filter((p) => p.item.id !== target.item.id).map((p) => placedOutline(p.item, p.placement));
    return slabFit(placedOutline(target.item, target.placement), slab, others);
  };
  const selected = shown.find((p) => p.item.id === selectedId) ?? null;
  const labelSize = slab.lengthMm / LABEL_DIVISOR;

  function commit(target: Placed, placement: SlabPlacement | undefined) {
    const { item } = target;
    if (item.edgeIndex === undefined) {
      dispatch({ type: 'updatePiece', areaId: item.areaId, pieceId: item.pieceId, patch: { slab: placement } });
    } else {
      dispatch({
        type: 'updateAttachedProfileSlab', areaId: item.areaId, pieceId: item.pieceId, edgeIndex: item.edgeIndex, slab: placement,
      });
    }
  }

  function onPointerDown(e: React.PointerEvent<SVGGElement>, target: Placed) {
    setSelectedId(target.item.id);
    setDrag({
      id: target.item.id, pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY,
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
          const outline = placedOutline(p.item, p.placement);
          const fit = liveFit(p);
          const xs = outline.map((pt) => pt.x);
          const ys = outline.map((pt) => pt.y);
          const centre = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
          return (
            <g
              key={p.item.id}
              tabIndex={0}
              role="button"
              aria-label={`Piece ${p.item.label} on slab ${slab.serial}, ${FIT_LABELS[fit]}`}
              aria-pressed={selectedId === p.item.id}
              onPointerDown={(e) => onPointerDown(e, p)}
              onPointerMove={onPointerMove}
              onPointerUp={(e) => onPointerUp(e, p)}
              onKeyDown={(e) => onKeyDown(e, p)}
              className="cursor-move outline-none"
            >
              <polygon
                points={outline.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                strokeWidth={selectedId === p.item.id ? 3 : 2}
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
                {p.item.label}
              </text>
            </g>
          );
        })}
      </svg>

      {shown.length > 0 && (
        <p role="status" className={cn('text-micro', badCount > 0 ? 'font-medium text-danger-ink' : 'text-ink-muted')}>
          {badCount > 0
            ? `${badCount} piece${badCount === 1 ? ' does' : 's do'} not fit here. Move ${badCount === 1 ? 'it' : 'them'} or try another slab.`
            : `${shown.length} piece${shown.length === 1 ? '' : 's'} on this slab, all fit.`}
        </p>
      )}

      {selected && (
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-micro text-ink">
            {selected.item.label}: {FIT_LABELS[liveFit(selected)]}
          </span>
          <button
            type="button"
            aria-label={`Rotate piece ${selected.item.label} a quarter turn`}
            title="Rotate 90° (R)"
            onClick={() => commit(selected, rotatedPlacement(selected.placement))}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <RotateCw className="size-3" aria-hidden="true" /> Rotate
          </button>
          <button
            type="button"
            aria-label={`Take piece ${selected.item.label} off this slab`}
            title="Take off the slab (Delete)"
            onClick={() => { commit(selected, undefined); setSelectedId(null); }}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-micro font-medium text-danger-ink hover:bg-destructive/10"
          >
            <Trash2 className="size-3" aria-hidden="true" /> Remove
          </button>
        </div>
      )}
    </div>
  );
}
