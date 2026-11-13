// Dragging a side of a piece with the Draw tool. The pointer's movement is
// projected onto the side's own perpendicular and snapped to 1/16", then the
// side (and so the piece) grows or shrinks that far while the opposite side
// stays put. The drag lives in local state and is saved as ONE edit on
// release — dispatching per pointer move would flood the undo history.

import { useState } from 'react';
import { toast } from 'sonner';
import type { Piece, Point } from '@/types/drawing';
import { DRAW_RESIZE_STEP_MM, MIN_DRAG_MM } from '@/lib/drawing/constants';
import { isClockwise, toLocalPoint } from '@/lib/drawing/geometry';
import { edgeNormal, pushEdge, snapToStep } from '@/lib/drawing/edgePush';
import { validatePiece } from '@/lib/drawing/validation';
import { screenPointToMm } from '@/lib/drawing/viewport';
import { useDrawingEditor } from './DrawingEditorContext';

const MOUSE_BUTTON = { primary: 0, secondary: 2 };

export interface EdgeRef {
  pieceId: string;
  index: number;
}

export interface EdgePreview extends EdgeRef {
  outline: Point[];
  valid: boolean;
}

interface DragState extends EdgeRef {
  pointerId: number;
  startPointer: Point;
  startOutline: Point[];
}

/** Why `outline` cannot replace the piece's shape, or null when it can. */
function problemWith(piece: Piece, outline: Point[]): string | null {
  const [issue] = validatePiece({ ...piece, outline });
  if (issue) return issue;
  // Dragging a side past its opposite flips the piece inside out: still a
  // simple shape, but wound the wrong way for dimension layout and DXF export.
  return isClockwise(outline) ? null : 'That would turn the piece inside out.';
}

export function useEdgeDrag() {
  const { state, dispatch } = useDrawingEditor();
  const [hover, setHover] = useState<EdgeRef | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [preview, setPreview] = useState<EdgePreview | null>(null);

  const pointerLocal = (e: React.PointerEvent<SVGElement>, piece: Piece): Point | null => {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return null;
    const world = screenPointToMm(e.clientX, e.clientY, svg.getBoundingClientRect(), state.zoom, state.pan);
    return toLocalPoint(world, piece.position, piece.rotationDeg);
  };

  const begin = (e: React.PointerEvent<SVGElement>, piece: Piece, index: number) => {
    if (e.button !== MOUSE_BUTTON.primary && e.button !== MOUSE_BUTTON.secondary) return;
    const startPointer = pointerLocal(e, piece);
    if (!startPointer) return;
    e.stopPropagation();
    // jsdom lacks pointer capture on SVG elements; every real browser has it.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dispatch({ type: 'selectPiece', pieceId: piece.id });
    setDrag({ pieceId: piece.id, index, pointerId: e.pointerId, startPointer, startOutline: piece.outline });
  };

  const update = (e: React.PointerEvent<SVGElement>, piece: Piece) => {
    if (!drag || drag.pointerId !== e.pointerId || drag.pieceId !== piece.id) return;
    const at = pointerLocal(e, piece);
    const normal = edgeNormal(drag.startOutline, drag.index);
    if (!at || !normal) return;
    const along = (at.x - drag.startPointer.x) * normal.x + (at.y - drag.startPointer.y) * normal.y;
    const outline = pushEdge(drag.startOutline, drag.index, snapToStep(along, DRAW_RESIZE_STEP_MM));
    setPreview({ pieceId: piece.id, index: drag.index, outline, valid: problemWith(piece, outline) === null });
  };

  const finish = (e: React.PointerEvent<SVGElement>, piece: Piece) => {
    if (!drag || drag.pointerId !== e.pointerId || drag.pieceId !== piece.id) return;
    const grew = preview !== null && preview.outline.some(
      (p, i) => Math.abs(p.x - piece.outline[i].x) > MIN_DRAG_MM || Math.abs(p.y - piece.outline[i].y) > MIN_DRAG_MM,
    );
    if (preview && grew) {
      const problem = problemWith(piece, preview.outline);
      if (problem) toast.error(problem);
      else dispatch({ type: 'updatePiece', areaId: state.activeAreaId, pieceId: piece.id, patch: { outline: preview.outline } });
    }
    setDrag(null);
    setPreview(null);
  };

  /** Abandons a drag in progress without saving it (Escape). */
  const cancel = () => {
    setDrag(null);
    setPreview(null);
  };

  /** `piece` as the canvas should draw it right now: with the dragged side
   *  already in its new place while a drag is under way. */
  const shown = (piece: Piece): Piece => (
    preview && preview.pieceId === piece.id ? { ...piece, outline: preview.outline } : piece
  );

  const active: EdgeRef | null = drag ?? hover;
  return { begin, update, finish, cancel, shown, hover: setHover, active, preview, dragging: drag !== null };
}

export type EdgeDrag = ReturnType<typeof useEdgeDrag>;
