// The small map in the canvas's bottom-left corner: the whole drawing in
// miniature with a box showing what the canvas is looking at. Drag the box (or
// click anywhere on the map) to move the view, scroll over the map to zoom,
// arrow keys and +/- do the same from the keyboard. The ✕ hides it; the bottom
// bar's Map button (or the M key) shows and hides it too.
//
// Kept cheap on purpose: the piece silhouettes are memoised and only the map's
// transform and the view box change while panning, drags are applied at most
// once per animation frame, and the map's extent is frozen for the length of a
// drag so it does not rescale under the pointer.

import { useEffect, useMemo, useRef, useState } from 'react';
import { WHEEL_ZOOM_STEP, ZOOM_STEP } from '@/lib/drawing/constants';
import { outlinePolyline } from '@/lib/drawing/arcs';
import { transformOutline } from '@/lib/drawing/geometry';
import {
  boxToWorld, fitExtent, mapExtent, padRect, piecesBounds, rectCenter, rectContains, viewportRect,
  type MapFit, type WorldRect,
} from '@/lib/drawing/minimap';
import type { Point } from '@/types/drawing';
import { useDrawingEditor } from './DrawingEditorContext';
import { MiniMapPieces, type MapShape } from './MiniMapPieces';

/** The map box's size in CSS pixels; the Tailwind classes below match it. */
const MAP_WIDTH_PX = 176;
const MAP_HEIGHT_PX = 112;

/** Share of the visible width an arrow key moves the view by. */
const KEY_PAN_RATIO = 0.1;

interface CanvasSize {
  width: number;
  height: number;
}

interface Drag {
  pointerId: number;
  fit: MapFit;
  /** Where in the view box the pointer took hold, so the box does not jump
   *  to centre itself on the pointer when it is picked up. */
  grab: Point;
}

export function MiniMap() {
  const { state, dispatch, mapOpen, toggleMap } = useDrawingEditor();
  const [canvasSize, setCanvasSize] = useState<CanvasSize | null>(null);
  const [frozenExtent, setFrozenExtent] = useState<WorldRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const frame = useRef<number | null>(null);
  const pendingCenter = useRef<Point | null>(null);

  const pieces = useMemo(
    () => state.present.areas.find((a) => a.id === state.activeAreaId)?.pieces ?? [],
    [state.present.areas, state.activeAreaId],
  );
  const shapes = useMemo<MapShape[]>(() => pieces.map((p) => ({
    id: p.id,
    points: transformOutline(outlinePolyline(p.outline, p.edges), p.position, p.rotationDeg).map((pt) => `${pt.x},${-pt.y}`).join(' '),
  })), [pieces]);
  const drawingBounds = useMemo(() => piecesBounds(pieces), [pieces]);

  // The canvas fills this component's parent, so the parent's size is the
  // canvas's size — which decides how much of the drawing the view box covers.
  useEffect(() => {
    const canvas = rootRef.current?.parentElement;
    if (!canvas) return undefined;
    const measure = () => {
      const { width, height } = canvas.getBoundingClientRect();
      setCanvasSize((current) => (current && current.width === width && current.height === height ? current : { width, height }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // A non-passive listener, so scrolling over the map zooms the drawing
  // without also scrolling the page behind it (React's own onWheel is passive).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      dispatch({ type: 'zoomView', factor: e.deltaY < 0 ? 1 + WHEEL_ZOOM_STEP : 1 - WHEEL_ZOOM_STEP });
    };
    map.addEventListener('wheel', onWheel, { passive: false });
    return () => map.removeEventListener('wheel', onWheel);
  }, [mapOpen, dispatch]);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  const view = canvasSize && canvasSize.width > 0 && canvasSize.height > 0
    ? viewportRect(state.pan, state.zoom, canvasSize.width, canvasSize.height)
    : null;
  const extent = frozenExtent
    ?? (view ? mapExtent(drawingBounds, view) : (drawingBounds ? padRect(drawingBounds) : null));
  const fit = extent ? fitExtent(extent, MAP_WIDTH_PX, MAP_HEIGHT_PX) : null;

  /** Moves the view at most once per animation frame, however fast the pointer reports. */
  const centerOn = (center: Point) => {
    pendingCenter.current = center;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (pendingCenter.current) dispatch({ type: 'centerView', center: pendingCenter.current });
      pendingCenter.current = null;
    });
  };

  const worldAt = (e: React.PointerEvent<SVGSVGElement>, using: MapFit): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = rect.width > 0 ? MAP_WIDTH_PX / rect.width : 1;
    const sy = rect.height > 0 ? MAP_HEIGHT_PX / rect.height : 1;
    return boxToWorld((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy, using);
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!fit || e.button !== 0) return;
    const at = worldAt(e, fit);
    const center = view ? rectCenter(view) : at;
    const grab = view && rectContains(view, at) ? { x: at.x - center.x, y: at.y - center.y } : { x: 0, y: 0 };
    drag.current = { pointerId: e.pointerId, fit, grab };
    setFrozenExtent(fit.extent);
    // jsdom lacks pointer capture on SVG elements; every real browser has it.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    centerOn({ x: at.x - grab.x, y: at.y - grab.y });
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== e.pointerId) return;
    const at = worldAt(e, current.fit);
    centerOn({ x: at.x - current.grab.x, y: at.y - current.grab.y });
  };

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current || drag.current.pointerId !== e.pointerId) return;
    // Land the view exactly where the pointer let go, not a frame behind it.
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    if (pendingCenter.current) dispatch({ type: 'centerView', center: pendingCenter.current });
    pendingCenter.current = null;
    drag.current = null;
    setFrozenExtent(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (!view) return;
    const center = rectCenter(view);
    const step = (view.maxX - view.minX) * KEY_PAN_RATIO;
    const moves: Record<string, Point> = {
      ArrowLeft: { x: center.x - step, y: center.y },
      ArrowRight: { x: center.x + step, y: center.y },
      ArrowUp: { x: center.x, y: center.y + step },
      ArrowDown: { x: center.x, y: center.y - step },
    };
    if (moves[e.key]) dispatch({ type: 'centerView', center: moves[e.key] });
    else if (e.key === '+' || e.key === '=') dispatch({ type: 'zoomView', factor: 1 + ZOOM_STEP });
    else if (e.key === '-') dispatch({ type: 'zoomView', factor: 1 - ZOOM_STEP });
    else return;
    e.preventDefault();
  };

  return (
    <div ref={rootRef} className="absolute bottom-3 right-3 z-10">
      {mapOpen && (
        <div
          ref={mapRef}
          role="region"
          aria-label="Drawing map"
          className="relative h-28 w-44 overflow-hidden rounded-lg border-2 border-stone-600 bg-stone-100 shadow-lg"
        >
          <svg
            data-testid="minimap"
            viewBox={`0 0 ${MAP_WIDTH_PX} ${MAP_HEIGHT_PX}`}
            tabIndex={0}
            aria-label="Drag to move around the drawing, scroll to zoom, or use the arrow keys and plus and minus"
            className="block h-full w-full cursor-pointer touch-none outline-none focus-visible:ring-2 focus-visible:ring-brand"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
          >
            {fit && (
              <g transform={`translate(${fit.offsetX - fit.extent.minX * fit.scale} ${fit.offsetY + fit.extent.maxY * fit.scale}) scale(${fit.scale})`}>
                <MiniMapPieces shapes={shapes} />
                {view && (
                  <rect
                    data-testid="minimap-view"
                    x={view.minX}
                    y={-view.maxY}
                    width={view.maxX - view.minX}
                    height={view.maxY - view.minY}
                    className="fill-brand/15 stroke-brand"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
            )}
          </svg>
          <button
            type="button"
            aria-label="Close map"
            onClick={toggleMap}
            className="absolute right-1 top-0.5 text-sm leading-none text-stone-700 hover:text-stone-950"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
