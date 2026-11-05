// The editor's SVG viewport: grid, pan/zoom, every piece + its dimension
// lines for the active area, the editing handles on the selected piece, and
// the keyboard shortcuts that act on the current selection. See this task's
// plan brief for the pixel/world convention: viewBox "0 0 800 600", origin
// centered at (400,300), 1 SVG unit = 1mm before the zoom scale.

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Point } from '@/types/drawing';
import { bounds, isClockwise, transformOutline } from '@/lib/drawing/geometry';
import { areaLetter, nextPieceLabel } from '@/lib/drawing/labels';
import { validateOutline } from '@/lib/drawing/validation';
import {
  ARROW_KEY_STEP_MM, GRID_SIZE_MM, SHIFT_ARROW_KEY_STEP_MM, VIEWPORT_HEIGHT, VIEWPORT_WIDTH, ZOOM_STEP,
} from '@/lib/drawing/constants';
import { pixelDeltaToViewboxUnits, screenPointToMm } from '@/lib/drawing/viewport';
import { DragPreviewContext, type DragPreview } from './DragPreviewContext';
import { useDrawingEditor } from './DrawingEditorContext';
import { PieceShape } from './PieceShape';
import { PieceHandles } from './PieceHandles';
import { PieceDimensions } from './PieceDimensions';
import { AnnotationLayer } from './AnnotationLayer';
import { CanvasOverlays, type Marquee } from './CanvasOverlays';
import { useAnnotationTool } from './useAnnotationTool';

const VIEWPORT_CENTER_X = VIEWPORT_WIDTH / 2;
const VIEWPORT_CENTER_Y = VIEWPORT_HEIGHT / 2;

/** How close (in mm) a newly-clicked polygon point can be to the last one
 *  before it's treated as a duplicate and dropped — a double-click (used to
 *  finish a polygon) fires two `pointerdown`s on almost the same spot, adding
 *  a zero-length edge. */
const DUPLICATE_POINT_TOLERANCE_MM = 5;

/** A background press that moves less than this many pixels is a click, not a pan. */
const CLICK_SLOP_PX = 3;

const DEFAULT_THICKNESS_MM = 30;

export function DrawingCanvas() {
  const { state, dispatch, tool, setTool, copySelection, pasteClipboard, duplicateSelection } = useDrawingEditor();
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [isPanning, setIsPanning] = useState(false);
  const [panMovedPx, setPanMovedPx] = useState(0);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const annotate = useAnnotationTool();

  const activeArea = state.present.areas.find((a) => a.id === state.activeAreaId);
  const areaIndex = state.present.areas.findIndex((a) => a.id === state.activeAreaId);
  const selectedIds = state.selectedPieceIds;
  const singleSelected = selectedIds.length === 1
    ? activeArea?.pieces.find((p) => p.id === selectedIds[0])
    : undefined;
  const move = (x: number, y: number) =>
    dispatch({ type: 'movePieces', areaId: state.activeAreaId, pieceIds: selectedIds, delta: { x, y } });

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const modifier = e.ctrlKey || e.metaKey;
    if (tool === 'polygon') {
      if (e.key === 'Enter' && draftPoints.length >= 3) finalizePolygon();
      else if (e.key === 'Escape') setDraftPoints([]);
      else if (e.key === 'Backspace') setDraftPoints((points) => points.slice(0, -1));
      return;
    }
    if (modifier) {
      const key = e.key.toLowerCase();
      if (key === 'c') copySelection();
      else if (key === 'v') pasteClipboard();
      else if (key === 'd') duplicateSelection();
      else if (key === 'a') dispatch({ type: 'selectPieces', pieceIds: (activeArea?.pieces ?? []).map((p) => p.id) });
      else return;
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape') {
      // A half-drawn line or dimension is what Escape is for first — only
      // once no tool is armed does it clear the selection.
      if (tool !== 'select') {
        annotate.cancel();
        setTool('select');
        setHoverPoint(null);
        return;
      }
      dispatch({ type: 'selectPiece', pieceId: null });
      return;
    }
    if (selectedIds.length === 0) return;
    const step = e.shiftKey ? SHIFT_ARROW_KEY_STEP_MM : ARROW_KEY_STEP_MM;
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); move(step, 0); break;
      case 'ArrowLeft': e.preventDefault(); move(-step, 0); break;
      case 'ArrowUp': e.preventDefault(); move(0, step); break;
      case 'ArrowDown': e.preventDefault(); move(0, -step); break;
      case 'Delete':
      case 'Backspace': {
        const piece = singleSelected;
        if (piece && state.selectedCutoutId) {
          dispatch({ type: 'deleteCutout', areaId: state.activeAreaId, pieceId: piece.id, cutoutId: state.selectedCutoutId });
        } else {
          dispatch({ type: 'deletePieces', areaId: state.activeAreaId, pieceIds: selectedIds });
        }
        // The deleted shape's own element held focus (it's how it got
        // selected); removing it would otherwise drop focus to <body> with no
        // indication where it went.
        e.currentTarget.focus();
        break;
      }
      case 'r':
        dispatch({ type: 'rotatePiece', areaId: state.activeAreaId, pieceId: selectedIds[0], pieceIds: selectedIds });
        break;
      default:
        break;
    }
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    dispatch({ type: 'setZoom', zoom: state.zoom * (e.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP) });
  };

  const pointerMm = (e: React.PointerEvent<SVGRectElement>): Point | null => {
    const svg = e.currentTarget.ownerSVGElement;
    return svg ? screenPointToMm(e.clientX, e.clientY, svg.getBoundingClientRect(), state.zoom, state.pan) : null;
  };

  const onBackgroundPointerDown = (e: React.PointerEvent<SVGRectElement>) => {
    const point = pointerMm(e);
    if (!point) return;
    // Captured up front so a drag that leaves the viewport still delivers its
    // pointerup here — that release is what finishes a dragged line.
    // jsdom lacks pointer capture on SVG elements; every real browser has it.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (tool === 'polygon') {
      setDraftPoints((points) => {
        const last = points[points.length - 1];
        // A double-click's second pointerdown lands on (nearly) the same
        // spot as the first — drop it rather than add a zero-length edge.
        if (last && Math.hypot(point.x - last.x, point.y - last.y) < DUPLICATE_POINT_TOLERANCE_MM) return points;
        return [...points, point];
      });
      return;
    }
    if (annotate.place(point)) {
      setHoverPoint(null);
      return;
    }
    if (e.shiftKey) {
      setMarquee({ from: point, to: point });
      return;
    }
    setIsPanning(true);
    setPanMovedPx(0);
  };

  const onBackgroundPointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    // The second point of a two-click tool follows the cursor, so the user
    // can see what they are about to draw before they commit to it.
    if (annotate.pendingFrom) setHoverPoint(pointerMm(e));
    else if (hoverPoint) setHoverPoint(null);
    if (marquee) {
      const point = pointerMm(e);
      if (point) setMarquee({ from: marquee.from, to: point });
      return;
    }
    if (!isPanning) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    setPanMovedPx((moved) => moved + Math.abs(e.movementX) + Math.abs(e.movementY));
    // pan is specified in the outer group's own (viewBox) coordinates, not
    // world mm — scale by the SVG's rendered size, but don't un-zoom or
    // y-negate it (unlike a world-space delta).
    dispatch({ type: 'pan', delta: pixelDeltaToViewboxUnits(e.movementX, e.movementY, svg.getBoundingClientRect()) });
  };

  const onBackgroundPointerUp = (e: React.PointerEvent<SVGRectElement>) => {
    // A press-drag-release on an armed line/dimension tool finishes it here;
    // a release that barely moved is just the first click of a click-click,
    // and leaves the pending point standing.
    const released = pointerMm(e);
    if (released && annotate.release(released)) {
      setHoverPoint(null);
      return;
    }
    if (marquee) {
      const minX = Math.min(marquee.from.x, marquee.to.x);
      const maxX = Math.max(marquee.from.x, marquee.to.x);
      const minY = Math.min(marquee.from.y, marquee.to.y);
      const maxY = Math.max(marquee.from.y, marquee.to.y);
      const hit = (activeArea?.pieces ?? []).filter((p) => {
        const b = bounds(transformOutline(p.outline, p.position, p.rotationDeg));
        return b.maxX >= minX && b.minX <= maxX && b.maxY >= minY && b.minY <= maxY;
      });
      dispatch({ type: 'selectPieces', pieceIds: hit.map((p) => p.id) });
      setMarquee(null);
      return;
    }
    // A press on empty canvas that never became a pan is a click: deselect.
    if (isPanning && panMovedPx < CLICK_SLOP_PX && selectedIds.length > 0) dispatch({ type: 'selectPiece', pieceId: null });
    setIsPanning(false);
  };

  const onBackgroundDoubleClick = () => {
    if (tool === 'polygon' && draftPoints.length >= 3) finalizePolygon();
  };

  function finalizePolygon() {
    if (!activeArea) return;
    // Dimension layout and DXF export assume rectOutline's clockwise winding.
    const outline = isClockwise(draftPoints) ? draftPoints : [...draftPoints].reverse();
    const issues = validateOutline(outline);
    if (issues.length > 0) {
      // Keep the points so the user can back one out (Backspace) and retry.
      toast.error(`That shape can't be cut: ${issues[0]}`);
      return;
    }
    dispatch({
      type: 'addPiece',
      areaId: state.activeAreaId,
      piece: {
        id: crypto.randomUUID(),
        label: nextPieceLabel(areaLetter(areaIndex), activeArea.pieces.map((p) => p.label)),
        shape: 'polygon',
        outline,
        position: { x: 0, y: 0 },
        rotationDeg: 0,
        thicknessMm: DEFAULT_THICKNESS_MM,
        edges: [],
        seams: [],
        cutouts: [],
      },
    });
    setDraftPoints([]);
    setTool('select');
  }

  const dragPreviewValue = useMemo(() => ({ preview: dragPreview, setPreview: setDragPreview }), [dragPreview]);

  return (
    <div
      role="application"
      aria-label="Drawing canvas"
      aria-describedby="drawing-canvas-shortcuts"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      className="h-full w-full outline-none"
    >
      {/* role="application" hands off all keystrokes to this widget, which
          makes its shortcuts undiscoverable to assistive tech otherwise. */}
      <p id="drawing-canvas-shortcuts" className="sr-only">
        With pieces selected: arrow keys move them, Shift plus an arrow key
        moves them in larger steps, R rotates them 90 degrees, Delete or
        Backspace removes them, Control plus C, V or D copies, pastes or
        duplicates them, and Control plus A selects every piece. Shift-click
        adds a piece to the selection. On a selected piece, Tab reaches each
        side and corner: arrow keys move a corner and Delete removes it. With
        the polygon tool active, click to place points, then press Enter or
        double-click to finish the shape once at least three points are
        placed; Backspace removes the last point and Escape cancels. With the
        line, dimension or note tool active, click the canvas to place each
        point — a line and a dimension take two, either by dragging from one
        to the other or by clicking each in turn — and Escape cancels.
      </p>
      <svg
        viewBox={`0 0 ${VIEWPORT_WIDTH} ${VIEWPORT_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
        className="block"
      >
        <defs>
          <pattern id="drawing-grid" width={GRID_SIZE_MM} height={GRID_SIZE_MM} patternUnits="userSpaceOnUse">
            <path d={`M 0 0 L 0 ${GRID_SIZE_MM} M 0 0 L ${GRID_SIZE_MM} 0`} className="stroke-stone-200" strokeWidth={0.5} />
          </pattern>
        </defs>
        <g transform={`translate(${VIEWPORT_CENTER_X},${VIEWPORT_CENTER_Y})`}>
          <g transform={`translate(${state.pan.x},${state.pan.y}) scale(${state.zoom})`}>
            <rect
              data-testid="canvas-background"
              x={-5000}
              y={-5000}
              width={10000}
              height={10000}
              fill="url(#drawing-grid)"
              onPointerDown={onBackgroundPointerDown}
              onPointerMove={onBackgroundPointerMove}
              onPointerUp={onBackgroundPointerUp}
              onDoubleClick={onBackgroundDoubleClick}
            />
            <DragPreviewContext.Provider value={dragPreviewValue}>
              {activeArea?.pieces.map((piece) => (
                <g key={piece.id}>
                  <PieceShape piece={piece} selected={selectedIds.includes(piece.id)} />
                  <PieceDimensions
                    piece={piece}
                    displayUnit={state.present.displayUnit}
                    fractionDenominator={state.present.fractionDenominator}
                  />
                </g>
              ))}
            </DragPreviewContext.Provider>
            {singleSelected && tool === 'select' && <PieceHandles piece={singleSelected} />}
            <CanvasOverlays marquee={marquee} draftPoints={tool === 'polygon' ? draftPoints : []} />
            <AnnotationLayer pendingFrom={annotate.pendingFrom} hoverPoint={hoverPoint} />
            {/* While a drawing tool is armed, every click belongs to that
                tool — including clicks over a piece, which is where a seam
                or a note usually goes. The background rect below cannot
                receive those: SVG delivers the event to the topmost shape
                and it bubbles up the tree, never sideways to a sibling
                underneath. So this transparent sheet sits above the
                geometry and takes the clicks instead. */}
            {tool !== 'select' && (
              <rect
                data-testid="tool-capture"
                x={-5000}
                y={-5000}
                width={10000}
                height={10000}
                fill="transparent"
                className="cursor-crosshair"
                onPointerDown={onBackgroundPointerDown}
                onPointerMove={onBackgroundPointerMove}
                onPointerUp={onBackgroundPointerUp}
                onDoubleClick={onBackgroundDoubleClick}
              />
            )}
          </g>
        </g>
      </svg>
    </div>
  );
}
