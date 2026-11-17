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

import { memo, useId, useMemo, useState } from 'react';
import type { Piece, Point } from '@/types/drawing';
import { hasArcs, outlinePath } from '@/lib/drawing/arcs';
import { snapToGrid, transformOutline } from '@/lib/drawing/geometry';
import { GRID_SIZE_MM, MIN_DRAG_MM, SNAP_TOLERANCE_MM } from '@/lib/drawing/constants';
import { validateCutouts } from '@/lib/drawing/cutouts';
import { snapNudge } from '@/lib/drawing/snapping';
import { pixelDeltaToMm } from '@/lib/drawing/viewport';
import { CutoutShape } from './CutoutShape';
import { useDragPreview } from './DragPreviewContext';
import { useDrawingEditor } from './DrawingEditorContext';
import { useMaterialPicker } from './MaterialPickerContext';
import { PieceEdgeColors } from './PieceEdgeColors';
import { PieceSlabTexture } from './PieceSlabTexture';
import { usePieceSlabTexture } from './usePieceSlabTexture';
import { useEdgeTypeList } from './EdgeTypesContext';
import { PieceLabel } from './PieceLabel';

/** On-screen outline weight, shared by selected and unselected pieces. */
const PIECE_STROKE_PX = 2;

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPosition: Point;
  movingIds: string[];
}

function PieceShapeBase({ piece, selected }: { piece: Piece; selected: boolean }) {
  const { state, dispatch, tool, workspace } = useDrawingEditor();
  const { preview, setPreview } = useDragPreview();
  const { pickingSlab, pickPiece } = useMaterialPicker();
  // The slab's photo, when this piece fits on a slab that has one.
  const slabTexture = usePieceSlabTexture(piece);
  const edgeTypes = useEdgeTypeList();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [previewPosition, setPreviewPosition] = useState<Point | null>(null);
  // useId() contains colons; they are legal in a url(#...) fragment but
  // trip up some tooling, so strip them.
  const seamClipId = `seam-clip-${useId().replace(/:/g, '')}`;

  // Another piece in the same selection is being dragged: follow it.
  const followDelta = !drag && preview?.pieceIds.includes(piece.id) ? preview.delta : null;
  const displayPosition = previewPosition
    ?? (followDelta ? { x: piece.position.x + followDelta.x, y: piece.position.y + followDelta.y } : piece.position);
  const worldOutline = transformOutline(piece.outline, displayPosition, piece.rotationDeg);
  const points = worldOutline.map((p) => `${p.x},${-p.y}`).join(' ');
  // A piece with a curved side is drawn as a path (true arcs); a plain one stays a polygon.
  const curved = hasArcs(piece.edges);
  // Over a slab photo the fill must not wash the stone out: transparent, with only the
  // selection tint left.
  const shapeClass = slabTexture
    ? (selected ? 'fill-brand/20 stroke-stone-900' : 'fill-transparent stroke-stone-900')
    : (selected ? 'fill-brand/30 stroke-stone-900' : 'fill-white/70 stroke-stone-900');
  const invalidCutoutIds = useMemo(
    () => new Set(validateCutouts(piece).flatMap((issue) => (issue.otherId ? [issue.cutoutId, issue.otherId] : [issue.cutoutId]))),
    [piece],
  );

  const select = (additive: boolean) => dispatch({ type: 'selectPiece', pieceId: piece.id, additive });

  const onPointerDown = (e: React.PointerEvent<SVGGElement>) => {
    if (tool !== 'select') return;
    // Select Pieces on the Material tab is armed: this click lays the piece on the slab.
    if (pickingSlab) {
      select(false);
      pickPiece(piece.id);
      return;
    }
    if (e.shiftKey) {
      select(true);
      return;
    }
    select(false);
    // In the Cutout / Material tabs a piece can be picked (to add a cutout to
    // it) but not moved — only cutouts are edited there.
    if (workspace !== 'sketch') return;
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
      className={pickingSlab ? 'cursor-crosshair outline-none' : 'cursor-move outline-none'}
    >
      {/* Strokes and text are divided by the zoom so they keep the same size
          on screen at any scale — a 200" piece zoomed out to fit would
          otherwise draw its outline and label too fine to read.
          Every piece, selected or not, has the same sharp dark outline at the
          same weight — brand green is reserved for a specific side
          (PieceHandles' highlighted edge) and for a side being dragged
          (EdgeDragLayer). Selection shows only in the inside: a light brand
          tint on the selected piece, plain white (the board's own colour) on
          the rest. Fills are slightly see-through, so two pieces overlapping
          each show their own outline through the other instead of one hiding
          the other. */}
      {slabTexture && piece.slab && (
        <PieceSlabTexture piece={piece} placement={piece.slab} position={displayPosition} texture={slabTexture} />
      )}
      {curved ? (
        <path
          d={outlinePath(worldOutline.map((p) => ({ x: p.x, y: -p.y })), piece.edges)}
          className={shapeClass}
          strokeWidth={PIECE_STROKE_PX / state.zoom}
        />
      ) : (
        <polygon points={points} className={shapeClass} strokeWidth={PIECE_STROKE_PX / state.zoom} />
      )}
      {/* The sides the Edges tool has painted, over the outline. */}
      <PieceEdgeColors piece={piece} worldOutline={worldOutline} types={edgeTypes} zoom={state.zoom} />
      {/* Local coordinates -> screen: position, then rotation, then the
          y-flip every world point gets on its way to SVG. */}
      <g transform={`translate(${displayPosition.x},${-displayPosition.y}) rotate(${piece.rotationDeg}) scale(1,-1)`}>
        {piece.seams.length > 0 && (
          // Clipped to the outline: a seam is drawn by eye, usually with its
          // ends a little past the edge to be sure it crosses, and the
          // overhang would read as a line leaving the stone.
          <>
            <defs>
              <clipPath id={seamClipId}>
                {curved ? (
                  // Drawn in screen orientation, then mirrored back into this
                  // group's y-up space, so the arcs keep their bow.
                  <path d={outlinePath(piece.outline.map((p) => ({ x: p.x, y: -p.y })), piece.edges)} transform="scale(1,-1)" />
                ) : (
                  <polygon points={piece.outline.map((p) => `${p.x},${p.y}`).join(' ')} />
                )}
              </clipPath>
            </defs>
            <g clipPath={`url(#${seamClipId})`}>
              {piece.seams.map((seam, i) => (
                // Index key: seams have no id of their own, and the list is
                // replaced wholesale whenever it changes.
                <line
                  key={i}
                  x1={seam.from.x}
                  y1={seam.from.y}
                  x2={seam.to.x}
                  y2={seam.to.y}
                  className="stroke-stone-700"
                  strokeWidth={2 / state.zoom}
                  strokeDasharray={`${10 / state.zoom} ${5 / state.zoom}`}
                />
              ))}
            </g>
          </>
        )}
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
      <PieceLabel label={piece.label} worldOutline={worldOutline} />
    </g>
  );
}

// Pieces re-render with the drag preview, but memo stops them re-rendering when
// the canvas re-renders for any other reason (selection of a different piece, pan).
export const PieceShape = memo(PieceShapeBase);
