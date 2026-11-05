// Click handling for the Note, Dimension and Line tools. A note is one click.
// A dimension and a line take two points, and accept either gesture people
// actually use for them: press-drag-release in one motion, or click once and
// click again. Whichever comes first wins — `release` finishes the line when
// the pointer has travelled far enough to be a drag, and otherwise leaves the
// first point standing for a second click.
//
// Points snap to a nearby piece corner so a measurement or a cut line meets
// real geometry rather than landing a fraction off it.
//
// A line becomes a seam on the piece it is drawn across, stored in that
// piece's own local coordinates so it moves and rotates with the piece.

import { useState } from 'react';
import type { Piece, Point } from '@/types/drawing';
import { areaVertices, dimensionProblem, newDimension, newNote, snapToVertex } from '@/lib/drawing/annotations';
import { SNAP_TOLERANCE_MM } from '@/lib/drawing/constants';
import { distance, toLocalPoint, transformOutline } from '@/lib/drawing/geometry';
import { pointInPolygon } from '@/lib/drawing/polygon';
import { useDrawingEditor } from './DrawingEditorContext';

const TWO_POINT_TOOLS = ['dimension', 'line'];

/** Travel, on screen, that separates "they dragged a line" from "they clicked
 *  and the mouse wobbled". Below it the first point stays put, waiting for a
 *  second click. */
const DRAG_THRESHOLD_PX = 6;

export function useAnnotationTool() {
  const { state, dispatch, tool, setTool } = useDrawingEditor();
  const [pending, setPending] = useState<{ from: Point; tool: string } | null>(null);
  const area = state.present.areas.find((a) => a.id === state.activeAreaId);

  const snap = (point: Point) => (
    area ? snapToVertex(point, areaVertices(area), SNAP_TOLERANCE_MM / state.zoom) : point
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
    if (!area || (tool !== 'note' && !TWO_POINT_TOOLS.includes(tool))) return false;
    const at = snap(point);
    if (tool === 'note') {
      dispatch({ type: 'setAnnotations', areaId: area.id, notes: [...area.notes, newNote(at, crypto.randomUUID())] });
      setTool('select');
      return true;
    }
    if (!pending || pending.tool !== tool) {
      setPending({ from: at, tool });
      return true;
    }
    finish(pending.from, at);
    return true;
  };

  /** Handles the release that ends a press-drag-release. A release that has
   *  barely moved is the first half of a click-click instead, so it leaves
   *  the pending point alone. */
  const release = (point: Point): boolean => {
    if (!pending || pending.tool !== tool || !TWO_POINT_TOOLS.includes(tool)) return false;
    const at = snap(point);
    if (distance(pending.from, at) < DRAG_THRESHOLD_PX / state.zoom) return false;
    finish(pending.from, at);
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
  const pendingFrom = TWO_POINT_TOOLS.includes(tool) && pending?.tool === tool ? pending.from : null;
  return { place, release, pendingFrom, cancel };
}

function pieceAt(pieces: Piece[], point: Point): Piece | undefined {
  // Last first: the piece drawn on top is the one the user is pointing at.
  return [...pieces].reverse().find((p) => pointInPolygon(point, transformOutline(p.outline, p.position, p.rotationDeg)));
}
