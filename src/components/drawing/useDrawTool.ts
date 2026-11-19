// The Draw tool's Square and Circle modes: one click on empty canvas drops a
// default-sized shape centred on the click and selects it, and the tool
// stays armed so several can be placed in a row. A click on an existing piece
// does nothing (it is how a piece is grabbed, not a place to draw another on
// top of it). Which shape a click drops, and Circle's own radius, come from
// the Draw tool's own state (DrawModeBar); Points is a different tool
// entirely (`polygon`, see DrawingCanvas) and never reaches this hook.

import type { Point } from '@/types/drawing';
import {
  DEFAULT_DRAW_DEPTH_MM, DEFAULT_DRAW_LENGTH_MM, DEFAULT_PIECE_THICKNESS_MM, DRAW_RESIZE_STEP_MM,
} from '@/lib/drawing/constants';
import { circleOutline, rectOutline, snapToGrid, transformOutline } from '@/lib/drawing/geometry';
import { areaLetter, nextPieceLabel } from '@/lib/drawing/labels';
import { pointInPolygon } from '@/lib/drawing/polygon';
import { useDrawingEditor } from './DrawingEditorContext';

export function useDrawTool() {
  const { state, dispatch, tool, draw } = useDrawingEditor();
  const area = state.present.areas.find((a) => a.id === state.activeAreaId);
  const areaIndex = state.present.areas.findIndex((a) => a.id === state.activeAreaId);

  /** Handles a click at `at`; false when the Draw tool is not armed. */
  const place = (at: Point): boolean => {
    if (tool !== 'draw' || !area) return false;
    const onAPiece = area.pieces.some((p) => pointInPolygon(at, transformOutline(p.outline, p.position, p.rotationDeg)));
    if (onAPiece) return true;

    const id = crypto.randomUUID();
    const label = nextPieceLabel(areaLetter(areaIndex), area.pieces.map((p) => p.label));
    const basePiece = {
      id, label, rotationDeg: 0, thicknessMm: DEFAULT_PIECE_THICKNESS_MM, edges: [], seams: [], cutouts: [],
    };
    if (draw.shape === 'circle') {
      dispatch({
        type: 'addPiece',
        areaId: area.id,
        piece: {
          ...basePiece,
          shape: 'circle',
          radiusMm: draw.circleRadiusMm,
          outline: circleOutline(draw.circleRadiusMm),
          // A circle's outline is centred on its own origin, so its position
          // is simply the click, snapped like the square's — unlike the
          // square there is no top-left offset to account for.
          position: snapToGrid(at, DRAW_RESIZE_STEP_MM),
        },
      });
    } else {
      // The outline's origin is its top-left corner, so centring the square on
      // the click means starting half a square up and to the left of it.
      const position = snapToGrid(
        { x: at.x - DEFAULT_DRAW_LENGTH_MM / 2, y: at.y + DEFAULT_DRAW_DEPTH_MM / 2 },
        DRAW_RESIZE_STEP_MM,
      );
      dispatch({
        type: 'addPiece',
        areaId: area.id,
        piece: { ...basePiece, shape: 'rect', outline: rectOutline(DEFAULT_DRAW_LENGTH_MM, DEFAULT_DRAW_DEPTH_MM), position },
      });
    }
    dispatch({ type: 'selectPiece', pieceId: id });
    return true;
  };

  return { place };
}
