// Dragging a side of a piece with the Draw tool. Pulled the way it faces, the
// side moves in/out in 1/16" steps while the opposite side stays put. Once the
// pointer turns and wanders LEG_TURN_PX along the side, that resize locks
// where it is and a 25 1/2" return leg grows off that end instead, from the
// side's new position. Turning again grows a second leg off the end of the
// first (a staircase: right, up, right — or up, then right), the earlier
// pieces staying where they were; wobble within LEG_TURN_PX of a turn is
// ignored. The drag lives in local state and is saved as ONE edit on release —
// dispatching per pointer move would flood the undo history.

import { useState } from 'react';
import { toast } from 'sonner';
import type { Piece, Point } from '@/types/drawing';
import { DRAW_RESIZE_STEP_MM, JOIN_SNAP_PX, LEG_TURN_PX, LEG_WIDTH_MM, MIN_DRAG_MM } from '@/lib/drawing/constants';
import { isClockwise, toLocalPoint } from '@/lib/drawing/geometry';
import { dragSideOutline, sideDragComponents, snapToStep } from '@/lib/drawing/edgePush';
import { validatePiece } from '@/lib/drawing/validation';
import { pixelDeltaToMm, screenPointToMm } from '@/lib/drawing/viewport';
import { useDrawingEditor } from './DrawingEditorContext';

const MOUSE_BUTTON = { primary: 0, secondary: 2 };

export interface EdgeRef {
  pieceId: string;
  index: number;
}

export interface EdgePreview extends EdgeRef {
  outline: Point[];
  valid: boolean;
  /** The one border being pulled right now (local piece coordinates) — the
   *  side itself while resizing, the leg's far end once a leg grows. What
   *  EdgeDragLayer highlights: a leg adds corners, so `outline` no longer
   *  lines up index-for-index with the original. */
  highlight: Point[];
}

interface DragState extends EdgeRef {
  pointerId: number;
  startPointer: Point;
  startOutline: Point[];
  /** The resize as of the last move before this one, so a turn locks the
   *  side where it was — not wherever the hand drifted on the way round. */
  lastAcross: number;
  /** The resize, frozen the moment the drag turned into a leg; null while
   *  it is still a plain resize. */
  lockedAcross: number | null;
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
    setDrag({
      pieceId: piece.id, index, pointerId: e.pointerId, startPointer, startOutline: piece.outline,
      lastAcross: 0, lockedAcross: null,
    });
  };

  const update = (e: React.PointerEvent<SVGElement>, piece: Piece) => {
    if (!drag || drag.pointerId !== e.pointerId || drag.pieceId !== piece.id) return;
    const svg = e.currentTarget.ownerSVGElement;
    const at = pointerLocal(e, piece);
    if (!at || !svg) return;
    const delta = { x: at.x - drag.startPointer.x, y: at.y - drag.startPointer.y };
    const parts = sideDragComponents(drag.startOutline, drag.index, delta);
    if (!parts) return;
    const rect = svg.getBoundingClientRect();
    const turnMm = Math.abs(pixelDeltaToMm(LEG_TURN_PX, 0, rect, state.zoom).x);
    const joinMm = Math.abs(pixelDeltaToMm(JOIN_SNAP_PX, 0, rect, state.zoom).x);
    const across = snapToStep(parts.across, DRAW_RESIZE_STEP_MM);
    let { lockedAcross } = drag;
    if (lockedAcross === null && Math.abs(parts.along) > turnMm) {
      lockedAcross = drag.lastAcross;
      setDrag({ ...drag, lockedAcross });
    } else if (lockedAcross === null) {
      setDrag({ ...drag, lastAcross: across });
    }
    const { outline, moved } = lockedAcross === null
      ? dragSideOutline(drag.startOutline, drag.index, across, 0, LEG_WIDTH_MM, joinMm)
      : dragSideOutline(
        drag.startOutline, drag.index, lockedAcross, snapToStep(parts.along, DRAW_RESIZE_STEP_MM), LEG_WIDTH_MM, joinMm,
        { delta, deadMm: turnMm, stepMm: DRAW_RESIZE_STEP_MM },
      );
    setPreview({ pieceId: piece.id, index: drag.index, outline, valid: problemWith(piece, outline) === null, highlight: moved });
  };

  const finish = (e: React.PointerEvent<SVGElement>, piece: Piece) => {
    if (!drag || drag.pointerId !== e.pointerId || drag.pieceId !== piece.id) return;
    const grew = preview !== null && (
      preview.outline.length !== piece.outline.length
      || preview.outline.some(
        (p, i) => Math.abs(p.x - piece.outline[i].x) > MIN_DRAG_MM || Math.abs(p.y - piece.outline[i].y) > MIN_DRAG_MM,
      )
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
