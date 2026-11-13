// Editing handles drawn over the single selected piece: a clickable strip
// along every side (selects that edge and opens its "Split" menu) and a
// draggable dot on every corner (moves it). A corner can also be moved with
// the arrow keys and removed with Delete or a double-click. Every change is
// checked against the piece's geometry rules (valid outline, cutouts still
// fitting) before it is saved — a bad drag is shown in red while it happens
// and discarded on release.
//
// Splitting a side used to be instant — a small "+" sitting right on the
// side, one click to add a corner there. That meant an accidental click
// anywhere near a side (or near a corner, whose own drag target overlaps it)
// could silently turn a clean rectangle into a polygon. It's now a
// deliberate second step: click the side to open a small "Split" menu next
// to it, then click Split.

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Piece, Point } from '@/types/drawing';
import {
  ARROW_KEY_STEP_MM, EDGE_HIT_WIDTH_PX, FINE_SNAP_MM, HANDLE_RADIUS_VB, SHIFT_ARROW_KEY_STEP_MM, SPLIT_MENU_OFFSET_PX,
} from '@/lib/drawing/constants';
import { edgeNormal } from '@/lib/drawing/edgePush';
import { outlineEdges, rotatePoint, snapToGrid, toWorldPoint } from '@/lib/drawing/geometry';
import { edgeLetter } from '@/lib/drawing/labels';
import { validatePiece } from '@/lib/drawing/validation';
import { insertVertex, moveVertex, removeVertex } from '@/lib/drawing/vertexEdit';
import { pixelDeltaToMm } from '@/lib/drawing/viewport';
import { useDrawingEditor } from './DrawingEditorContext';
import { EdgeSplitMenu } from './EdgeSplitMenu';

/** Covers the same huge area as the canvas's own background/tool-capture
 *  rects, so a pointerdown anywhere outside the menu itself closes it. */
const CLICK_AWAY_EXTENT_MM = 5000;

const MIN_CORNERS = 3;

interface CornerDrag {
  index: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  preview: Point;
}

export function PieceHandles({ piece }: { piece: Piece }) {
  const { state, dispatch } = useDrawingEditor();
  const [drag, setDrag] = useState<CornerDrag | null>(null);
  // Which side's "Split" menu is open, if any. Reset whenever the piece's own
  // outline changes (a split, a resize, moving a corner) — after a split
  // every index past it shifts, and after some other edit the menu's own
  // side may no longer be what the user was just looking at. Done during
  // render (React's own "adjusting state when a prop changes" pattern), not
  // in an effect, so it takes effect before this render paints rather than
  // flashing the stale menu for a frame first.
  const [splitMenuEdge, setSplitMenuEdge] = useState<number | null>(null);
  const [outlineForMenu, setOutlineForMenu] = useState(piece.outline);
  if (outlineForMenu !== piece.outline) {
    setOutlineForMenu(piece.outline);
    if (splitMenuEdge !== null) setSplitMenuEdge(null);
  }
  const radius = HANDLE_RADIUS_VB / state.zoom;

  const toScreen = (local: Point) => {
    const w = toWorldPoint(local, piece.position, piece.rotationDeg);
    return { x: w.x, y: -w.y };
  };

  /** Saves `outline` as the piece's new shape if it is still a valid piece,
   *  otherwise tells the user why not. Returns whether it was saved. */
  const commit = (outline: Point[], edges = piece.edges): boolean => {
    const issues = validatePiece({ ...piece, outline });
    if (issues.length > 0) {
      toast.error(issues[0]);
      return false;
    }
    dispatch({
      type: 'updatePiece', areaId: state.activeAreaId, pieceId: piece.id,
      patch: { outline, edges, shape: 'polygon' },
    });
    return true;
  };

  // One side's hit-strip <line> per edge index, so closing its menu can hand
  // keyboard focus back there — otherwise, since the Split/Close button a
  // keyboard user just activated is what gets unmounted, focus would
  // silently fall to <body> (the same failure DrawingCanvas's own Delete-key
  // handler already guards against for a deleted piece). Read only inside
  // the effect below, never during render — this repo's react-hooks/refs
  // lint rule refuses a ref read from a function passed down as a prop,
  // since it can't prove the child only calls it from an event handler.
  const edgeRefs = useRef<(SVGLineElement | null)[]>([]);
  const lastMenuEdge = useRef<number | null>(null);

  useEffect(() => {
    if (splitMenuEdge !== null) { lastMenuEdge.current = splitMenuEdge; return; }
    if (lastMenuEdge.current === null) return;
    edgeRefs.current[lastMenuEdge.current]?.focus();
    lastMenuEdge.current = null;
  }, [splitMenuEdge]);

  const splitEdge = (edgeIndex: number) => {
    const next = insertVertex({ outline: piece.outline, edges: piece.edges }, edgeIndex);
    commit(next.outline, next.edges);
  };

  const removeCorner = (index: number) => {
    if (piece.outline.length <= MIN_CORNERS) {
      toast.error('A piece needs at least 3 corners.');
      return;
    }
    const next = removeVertex({ outline: piece.outline, edges: piece.edges }, index);
    commit(next.outline, next.edges);
  };

  const previewOutline = drag ? moveVertex(piece.outline, drag.index, drag.preview) : null;
  const previewBad = previewOutline ? validatePiece({ ...piece, outline: previewOutline }).length > 0 : false;

  const onCornerDown = (e: React.PointerEvent<SVGCircleElement>, index: number) => {
    e.stopPropagation();
    setDrag({ index, pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, preview: piece.outline[index] });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onCornerMove = (e: React.PointerEvent<SVGCircleElement>) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const world = pixelDeltaToMm(e.clientX - drag.startClientX, e.clientY - drag.startClientY, svg.getBoundingClientRect(), state.zoom);
    const local = rotatePoint(world, -piece.rotationDeg);
    const start = piece.outline[drag.index];
    setDrag({ ...drag, preview: snapToGrid({ x: start.x + local.x, y: start.y + local.y }, FINE_SNAP_MM) });
  };

  const onCornerUp = (e: React.PointerEvent<SVGCircleElement>) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const start = piece.outline[drag.index];
    if (drag.preview.x !== start.x || drag.preview.y !== start.y) commit(moveVertex(piece.outline, drag.index, drag.preview));
    setDrag(null);
  };

  const onCornerKey = (e: React.KeyboardEvent<SVGCircleElement>, index: number) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      removeCorner(index);
      return;
    }
    const step = e.shiftKey ? SHIFT_ARROW_KEY_STEP_MM : ARROW_KEY_STEP_MM;
    const world: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: step }, ArrowDown: { x: 0, y: -step },
    };
    const move = world[e.key];
    if (!move) return;
    e.preventDefault();
    e.stopPropagation();
    const local = rotatePoint(move, -piece.rotationDeg);
    const from = piece.outline[index];
    commit(moveVertex(piece.outline, index, { x: from.x + local.x, y: from.y + local.y }));
  };

  const edges = outlineEdges(piece.outline);

  return (
    <g>
      {splitMenuEdge !== null && (
        <rect
          data-testid="split-menu-click-away"
          x={-CLICK_AWAY_EXTENT_MM} y={-CLICK_AWAY_EXTENT_MM}
          width={CLICK_AWAY_EXTENT_MM * 2} height={CLICK_AWAY_EXTENT_MM * 2}
          fill="transparent"
          aria-hidden="true"
          onPointerDown={() => setSplitMenuEdge(null)}
        />
      )}

      {edges.map(([a, b], i) => {
        const sa = toScreen(a);
        const sb = toScreen(b);
        const selected = state.selectedEdgeIndex === i;
        const menuOpen = splitMenuEdge === i;
        const select = () => {
          dispatch({ type: 'selectEdge', pieceId: piece.id, edgeIndex: i });
          // A second click on the same side's already-selected strip closes
          // its menu again instead of leaving it stuck open.
          setSplitMenuEdge((open) => (open === i ? null : i));
        };
        return (
          <g key={`edge-${i}`}>
            {selected && (
              <line x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} className="stroke-brand" strokeWidth={4} vectorEffect="non-scaling-stroke" />
            )}
            <line
              ref={(el) => { edgeRefs.current[i] = el; }}
              x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y}
              role="button"
              tabIndex={0}
              aria-label={`Side ${edgeLetter(i)} of ${piece.label}${selected ? ', selected' : ''}`}
              aria-expanded={menuOpen}
              stroke="transparent"
              strokeWidth={EDGE_HIT_WIDTH_PX}
              vectorEffect="non-scaling-stroke"
              className="cursor-pointer outline-none"
              onPointerDown={(e) => { e.stopPropagation(); select(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
                else if (e.key === 'Escape' && menuOpen) { e.preventDefault(); e.stopPropagation(); setSplitMenuEdge(null); }
              }}
            />
          </g>
        );
      })}

      {previewOutline && (
        <polygon
          points={previewOutline.map((p) => { const s = toScreen(p); return `${s.x},${s.y}`; }).join(' ')}
          fill="none"
          strokeDasharray="6 4"
          className={previewBad ? 'stroke-red-600' : 'stroke-brand'}
          aria-hidden="true"
        />
      )}

      {splitMenuEdge !== null && (() => {
        const i = splitMenuEdge;
        const [a, b] = edges[i];
        const mid = toScreen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        const normal = edgeNormal(piece.outline, i) ?? { x: 0, y: 0 };
        // The piece's own rotation turns the outward normal with it, same as
        // any other local-to-world vector here.
        const rotated = rotatePoint(normal, piece.rotationDeg);
        const outward = { x: rotated.x, y: -rotated.y };
        const offset = SPLIT_MENU_OFFSET_PX / state.zoom;
        const at = { x: mid.x + outward.x * offset, y: mid.y + outward.y * offset };
        return (
          <EdgeSplitMenu
            at={at}
            zoom={state.zoom}
            letter={edgeLetter(i)}
            onSplit={() => splitEdge(i)}
            onClose={() => setSplitMenuEdge(null)}
          />
        );
      })()}

      {piece.outline.map((corner, i) => {
        const at = toScreen(drag?.index === i ? drag.preview : corner);
        const dragBad = drag?.index === i && previewBad;
        return (
          <circle
            key={`corner-${i}`}
            cx={at.x} cy={at.y} r={radius}
            role="button"
            tabIndex={0}
            aria-label={`Corner ${i + 1} of ${piece.label}. Arrow keys move it, Delete removes it.`}
            className={`cursor-move outline-none ${dragBad ? 'fill-red-500 stroke-red-700' : 'fill-brand stroke-stone-700'}`}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            onPointerDown={(e) => onCornerDown(e, i)}
            onPointerMove={onCornerMove}
            onPointerUp={onCornerUp}
            onDoubleClick={() => removeCorner(i)}
            onKeyDown={(e) => onCornerKey(e, i)}
          />
        );
      })}
    </g>
  );
}
