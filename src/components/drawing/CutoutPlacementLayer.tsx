// Putting a new cutout on a piece: after Save in the Cutout dialog the cursor
// becomes a target, the cutout follows it over the piece as a ghost, and a
// click drops it there (snapped to a quarter inch). A spot that breaks a
// placement rule — outside the piece, too near an edge, on another cutout — is
// shown red and refuses the click with the reason. Escape cancels.
//
// It is a transparent sheet above the whole board, like the tools' click
// catcher, so nothing underneath (pieces, handles) reacts while placing.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Point } from '@/types/drawing';
import { FINE_SNAP_MM } from '@/lib/drawing/constants';
import { cutoutOutline, validateCutouts } from '@/lib/drawing/cutouts';
import { snapToGrid, toLocalPoint } from '@/lib/drawing/geometry';
import { screenPointToMm } from '@/lib/drawing/viewport';
import { CutoutLabel } from './CutoutLabel';
import { CutoutPicture } from './CutoutPicture';
import { useDrawingEditor } from './DrawingEditorContext';

const SHEET_MM = 5000;

export function CutoutPlacementLayer() {
  const { state, dispatch, placing, cancelPlacing } = useDrawingEditor();
  const [hover, setHover] = useState<Point | null>(null);

  useEffect(() => {
    if (!placing) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelPlacing();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [placing, cancelPlacing]);

  const area = state.present.areas.find((a) => a.id === state.activeAreaId);
  const piece = placing ? area?.pieces.find((p) => p.id === placing.pieceId) : undefined;
  if (!placing || !piece) return null;

  const localAt = (e: React.PointerEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>): Point | null => {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return null;
    const world = screenPointToMm(e.clientX, e.clientY, svg.getBoundingClientRect(), state.zoom, state.pan);
    return snapToGrid(toLocalPoint(world, piece.position, piece.rotationDeg), FINE_SNAP_MM);
  };

  const ghost = { ...placing.cutout, center: hover ?? placing.cutout.center };
  const issues = validateCutouts({ outline: piece.outline, cutouts: [...piece.cutouts, ghost] });
  const problem = issues.length > 0 ? issues[issues.length - 1].message : null;
  const outline = cutoutOutline(ghost);

  const place = (e: React.MouseEvent<SVGRectElement>) => {
    const at = localAt(e);
    if (!at) return;
    const placed = { ...placing.cutout, center: at };
    const rejected = validateCutouts({ outline: piece.outline, cutouts: [...piece.cutouts, placed] });
    if (rejected.length > 0) {
      toast.error(rejected[rejected.length - 1].message);
      return;
    }
    dispatch({ type: 'addCutout', areaId: state.activeAreaId, pieceId: piece.id, cutout: placed });
    cancelPlacing();
  };

  return (
    <g>
      <rect
        data-testid="cutout-placement"
        x={-SHEET_MM}
        y={-SHEET_MM}
        width={SHEET_MM * 2}
        height={SHEET_MM * 2}
        fill="transparent"
        className="cursor-crosshair"
        onPointerMove={(e) => setHover(localAt(e))}
        onClick={place}
      />
      {hover && (
        <g
          aria-hidden="true"
          pointerEvents="none"
          transform={`translate(${piece.position.x},${-piece.position.y}) rotate(${piece.rotationDeg}) scale(1,-1)`}
        >
          <polygon
            data-testid="cutout-ghost"
            data-valid={problem === null}
            points={outline.map((p) => `${p.x},${p.y}`).join(' ')}
            className={problem ? 'fill-red-100/70 stroke-red-600' : 'fill-sky-100/70 stroke-sky-600'}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="6 3"
          />
          <CutoutPicture cutout={ghost} />
          <CutoutLabel cutout={ghost} rotationDeg={piece.rotationDeg} />
        </g>
      )}
    </g>
  );
}
