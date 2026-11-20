// Click handling for the Text, Note, Dimension and Line tools. A note and a
// piece of text are one click.
// A dimension and a line take two points, and accept either gesture people
// actually use for them: press-drag-release in one motion, or click once and
// click again. Whichever comes first wins — `release` finishes the line when
// the pointer has travelled far enough to be a drag, and otherwise leaves the
// first point standing for a second click.
//
// Points snap (lib/drawing/annotationSnap.ts) to a nearby piece corner, to the spot straight
// across from the first point, or to a border, so a measurement or a cut line meets real
// geometry — and a seam reaches the far side of a top — without the click being exact.
//
// A line becomes a seam on the piece it is drawn across, stored in that
// piece's own local coordinates so it moves and rotates with the piece.

import { useMemo, useState } from 'react';
import type { Piece, Point } from '@/types/drawing';
import { dimensionProblem, newDimension, newNote } from '@/lib/drawing/annotations';
import { snapAnnotationPoint, snapGeometry, type Snap } from '@/lib/drawing/annotationSnap';
import { ANNOTATION_SNAP_PX } from '@/lib/drawing/constants';
import { distance, toLocalPoint, transformOutline } from '@/lib/drawing/geometry';
import { newTextNote, noteHit } from '@/lib/drawing/textNotes';
import { pointInPolygon } from '@/lib/drawing/polygon';
import { useDrawingEditor } from './DrawingEditorContext';

const TWO_POINT_TOOLS = ['dimension', 'line'];

/** Travel, on screen, that separates "they dragged a line" from "they clicked
 *  and the mouse wobbled". Below it the first point stays put, waiting for a
 *  second click. */
const DRAG_THRESHOLD_PX = 6;

export function useAnnotationTool() {
  const { state, dispatch, tool, setTool, selectNote } = useDrawingEditor();
  const [pending, setPending] = useState<{ from: Point; tool: string; side?: [Point, Point] } | null>(null);
  const area = state.present.areas.find((a) => a.id === state.activeAreaId);
  const geometry = useMemo(() => (area ? snapGeometry(area) : { corners: [], outlines: [] }), [area]);
  const active = pending && pending.tool === tool ? pending : null;

  /** Where `point` lands: the line's second point is also drawn to the spot straight across from its first. */
  const snap = (point: Point): Snap => snapAnnotationPoint(
    point, geometry, ANNOTATION_SNAP_PX / state.zoom, active ? { point: active.from, side: active.side } : undefined,
  );

  function finish(from: Point, to: Point) {
    if (!area) return;
    if (dimensionProblem(from, to, 0) === null) {
      if (tool === 'line') addSeam(from, to);
      else {
        dispatch({
          type: 'setAnnotations', areaId: area.id,
          dimensions: [...(area.dimensions ?? []), newDimension(from, to, crypto.randomUUID())],
        });
      }
    }
    setPending(null);
    setTool('select');
  }

  /** Handles a press on the canvas; false when no drawing tool is armed. */
  const place = (point: Point): boolean => {
    if (!area) return false;
    if (tool === 'text') {
      // A press on text already on the board picks that text up; a press on
      // empty board drops a new one right there. Either way the control bar
      // opens on it and the tool hands back to Select.
      const existing = [...area.notes].reverse().find((n) => noteHit(n, point, state.zoom));
      if (existing) {
        selectNote(existing.id);
      } else {
        const created = newTextNote(point, crypto.randomUUID());
        dispatch({ type: 'setAnnotations', areaId: area.id, notes: [...area.notes, created] });
        selectNote(created.id);
      }
      setTool('select');
      return true;
    }
    if (tool !== 'note' && !TWO_POINT_TOOLS.includes(tool)) return false;
    const snapped = snap(point);
    if (tool === 'note') {
      dispatch({ type: 'setAnnotations', areaId: area.id, notes: [...area.notes, newNote(snapped.point, crypto.randomUUID())] });
      setTool('select');
      return true;
    }
    if (!active) {
      setPending({ from: snapped.point, tool, side: snapped.side });
      return true;
    }
    finish(active.from, snapped.point);
    return true;
  };

  /** Handles the release that ends a press-drag-release. A release that has
   *  barely moved is the first half of a click-click instead, so it leaves
   *  the pending point alone. */
  const release = (point: Point): boolean => {
    if (!active || !TWO_POINT_TOOLS.includes(tool)) return false;
    const at = snap(point).point;
    if (distance(active.from, at) < DRAG_THRESHOLD_PX / state.zoom) return false;
    finish(active.from, at);
    return true;
  };

  /** Adds the line as a seam on the piece under either of its ends. A line
   *  drawn over empty canvas belongs to no piece, so it is dropped rather
   *  than stored somewhere nothing could ever cut it from. */
  function addSeam(from: Point, to: Point) {
    const pieces = area?.pieces ?? [];
    const piece = pieceAt(pieces, from) ?? pieceAt(pieces, to);
    if (!piece || !area) return;
    dispatch({
      type: 'setSeams',
      areaId: area.id,
      pieceId: piece.id,
      seams: [...piece.seams, {
        from: toLocalPoint(from, piece.position, piece.rotationDeg),
        to: toLocalPoint(to, piece.position, piece.rotationDeg),
      }],
    });
  }

  /** Throws away a half-drawn line or dimension. */
  const cancel = () => setPending(null);

  /** The first point of a two-point tool, while that tool is still active. */
  const pendingFrom = TWO_POINT_TOOLS.includes(tool) ? active?.from ?? null : null;
  /** Whether a seam or dimension is being drawn — so the board tracks the pointer to show where a click would land. */
  const armed = TWO_POINT_TOOLS.includes(tool);
  /** Where a click at `point` would land, for the preview ring; null outside those tools. */
  const preview = (point: Point): Snap | null => (armed ? snap(point) : null);
  return { place, release, pendingFrom, cancel, armed, preview };
}

function pieceAt(pieces: Piece[], point: Point): Piece | undefined {
  // Last first: the piece drawn on top is the one the user is pointing at.
  return [...pieces].reverse().find((p) => pointInPolygon(point, transformOutline(p.outline, p.position, p.rotationDeg)));
}
