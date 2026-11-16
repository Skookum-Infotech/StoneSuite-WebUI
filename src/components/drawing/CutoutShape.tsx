// One cutout, drawn in its piece's local coordinates (the parent <g> supplies
// the position/rotation/y-flip transform). It is the real opening — the same
// outline cutouts.ts measures and validates — not a decoration. Cutouts are
// edited in the Cutout tab only: there, a click opens the Cutout dialog on it
// and dragging moves it; in Sketch it is just drawn, and clicks and drags go
// through to the piece underneath. A dragged position that would break a placement rule
// (outside the piece, too near an edge, overlapping another cutout) is shown
// in red and never saved: the cutout snaps back on release. Its name and
// Length x Height sit in the middle (CutoutLabel), and any distance lines it
// asks for run out to the piece's edge (CutoutDistanceLines).

import { useState } from 'react';
import type { Cutout, Piece, Point } from '@/types/drawing';
import { FINE_SNAP_MM, MIN_DRAG_MM } from '@/lib/drawing/constants';
import { CUTOUT_TYPE_LABELS, cutoutOutline, cutoutPatchProblem } from '@/lib/drawing/cutouts';
import { rotatePoint, snapToGrid } from '@/lib/drawing/geometry';
import { pixelDeltaToMm } from '@/lib/drawing/viewport';
import { CutoutDistanceLines } from './CutoutDistanceLines';
import { CutoutLabel } from './CutoutLabel';
import { useDrawingEditor } from './DrawingEditorContext';

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCenter: Point;
}

export function CutoutShape(
  { piece, cutout, selected, invalid }: { piece: Piece; cutout: Cutout; selected: boolean; invalid: boolean },
) {
  const { state, dispatch, tool, workspace, editCutout } = useDrawingEditor();
  const editable = workspace === 'cutout' && tool === 'select';
  const [drag, setDrag] = useState<DragState | null>(null);
  const [previewCenter, setPreviewCenter] = useState<Point | null>(null);

  const shown: Cutout = previewCenter ? { ...cutout, center: previewCenter } : cutout;
  const outline = cutoutOutline(shown);
  const previewInvalid = previewCenter ? cutoutPatchProblem(piece, cutout, { center: previewCenter }) !== null : false;
  const bad = invalid || previewInvalid;
  const name = cutout.label || CUTOUT_TYPE_LABELS[cutout.type];

  const onPointerDown = (e: React.PointerEvent<SVGPolygonElement>) => {
    if (!editable) return;
    // The piece underneath would otherwise start its own drag.
    e.stopPropagation();
    dispatch({ type: 'selectCutout', pieceId: piece.id, cutoutId: cutout.id });
    setDrag({ pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, startCenter: cutout.center });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<SVGPolygonElement>) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const worldDelta = pixelDeltaToMm(e.clientX - drag.startClientX, e.clientY - drag.startClientY, svg.getBoundingClientRect(), state.zoom);
    // The pointer moves in world space; the cutout lives in the piece's own,
    // possibly rotated, space.
    const local = rotatePoint(worldDelta, -piece.rotationDeg);
    setPreviewCenter(snapToGrid({ x: drag.startCenter.x + local.x, y: drag.startCenter.y + local.y }, FINE_SNAP_MM));
  };

  const onPointerUp = (e: React.PointerEvent<SVGPolygonElement>) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const moved = previewCenter
      && (Math.abs(previewCenter.x - cutout.center.x) > MIN_DRAG_MM || Math.abs(previewCenter.y - cutout.center.y) > MIN_DRAG_MM);
    if (moved && !previewInvalid) {
      dispatch({ type: 'updateCutout', areaId: state.activeAreaId, pieceId: piece.id, cutoutId: cutout.id, patch: { center: previewCenter } });
    } else if (!moved) {
      // A click, not a drag: open it for editing.
      editCutout(cutout.id);
    }
    setDrag(null);
    setPreviewCenter(null);
  };

  // Keyboard path to the cutout; its exact position and size are edited in the
  // inspector (X/Y/width/height fields), which is the accessible alternative to dragging.
  const onKeyDown = (e: React.KeyboardEvent<SVGPolygonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type: 'selectCutout', pieceId: piece.id, cutoutId: cutout.id });
    editCutout(cutout.id);
  };

  if (outline.length < 3) return null;

  let paint = 'fill-sky-100/70 stroke-sky-600';
  if (bad) paint = 'fill-red-100/70 stroke-red-600';
  else if (selected && editable) paint = 'fill-sky-200/80 stroke-sky-700';

  return (
    <g>
      <polygon
        points={outline.map((p) => `${p.x},${p.y}`).join(' ')}
        {...(editable ? {
          role: 'button',
          tabIndex: 0,
          'aria-label': `${name}${selected ? ', selected' : ''}${bad ? ', invalid position' : ''}`,
          onKeyDown,
          onPointerDown,
          onPointerMove,
          onPointerUp,
        } : { pointerEvents: 'none' as const })}
        className={`${paint} ${editable ? 'cursor-grab' : ''}`}
        strokeWidth={selected && editable ? 2 : 1}
        strokeDasharray={bad ? '6 3' : undefined}
      />
      <CutoutDistanceLines piece={piece} cutout={shown} />
      <CutoutLabel cutout={shown} rotationDeg={piece.rotationDeg} />
    </g>
  );
}
