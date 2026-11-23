// Read-only view of an uploaded DXF: zoom, pan, fit. Text from the file is only
// ever an SVG <text> child, so React escapes it.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';
import { fitViewBox, panBy, screenToWorld, zoomAt, type ViewBox } from '@/lib/drawing/dxfViewport';
import type { DxfScene } from '@/lib/drawing/dxfSceneTypes';

const ZOOM_STEP = 1.25;
const KEYBOARD_PAN_PX = 40;
const DASH_PATTERN = '6 4';
const CONTROL_CLASS = 'flex size-7 items-center justify-center rounded text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

function center(vb: ViewBox) {
  return { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 };
}

export function DxfViewer({ scene, label }: { scene: DxfScene; label: string }) {
  const fit = useMemo(() => fitViewBox(scene.bounds), [scene.bounds]);
  const [viewBox, setViewBox] = useState(fit);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragFrom = useRef<{ x: number; y: number } | null>(null);

  // React attaches wheel listeners passively, which can't stop the page scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setViewBox((vb) => zoomAt(vb, fit, factor, screenToWorld(vb, rect, event.clientX, event.clientY)));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [fit]);

  // Memoised: every drag step re-renders, and the drawing can be thousands of nodes.
  const drawing = useMemo(() => (
    <>
      {scene.paths.map((path) => (
        <path
          key={`${path.dashed}-${path.filled}`}
          d={path.d}
          vectorEffect="non-scaling-stroke"
          strokeWidth={1}
          strokeDasharray={path.dashed ? DASH_PATTERN : undefined}
          className={path.filled ? 'fill-stone-800 stroke-none' : path.dashed ? 'fill-none stroke-stone-400' : 'fill-none stroke-stone-800'}
        />
      ))}
      {scene.texts.map((text, i) => (
        <text
          key={i}
          x={text.x}
          y={text.y}
          fontSize={text.height}
          textAnchor={text.anchor}
          dominantBaseline={text.baseline}
          textRendering="geometricPrecision"
          transform={`rotate(${-text.rotationDeg} ${text.x} ${text.y})`}
          className="fill-stone-800 select-none"
        >
          {text.text}
        </text>
      ))}
    </>
  ), [scene.paths, scene.texts]);

  const zoom = (factor: number) => setViewBox((vb) => zoomAt(vb, fit, factor, center(vb)));

  const panPixels = (dx: number, dy: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setViewBox((vb) => panBy(vb, dx, dy, rect));
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragFrom.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragFrom.current) return;
    panPixels(event.clientX - dragFrom.current.x, event.clientY - dragFrom.current.y);
    dragFrom.current = { x: event.clientX, y: event.clientY };
  };

  const endDrag = () => {
    dragFrom.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const actions: Record<string, () => void> = {
      ArrowLeft: () => panPixels(KEYBOARD_PAN_PX, 0),
      ArrowRight: () => panPixels(-KEYBOARD_PAN_PX, 0),
      ArrowUp: () => panPixels(0, KEYBOARD_PAN_PX),
      ArrowDown: () => panPixels(0, -KEYBOARD_PAN_PX),
      '+': () => zoom(ZOOM_STEP),
      '=': () => zoom(ZOOM_STEP),
      '-': () => zoom(1 / ZOOM_STEP),
      '0': () => setViewBox(fit),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  return (
    <div
      role="group"
      aria-label={`${label} drawing viewer`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="relative overflow-hidden rounded-lg border border-stone-200 bg-white outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <svg
        ref={svgRef}
        role="img"
        aria-label={label}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="block h-[65vh] min-h-80 w-full cursor-grab touch-none active:cursor-grabbing"
      >
        {drawing}
      </svg>
      <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-md border border-stone-200 bg-white p-0.5 shadow-sm">
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoom(ZOOM_STEP)} className={CONTROL_CLASS}>
          <Plus className="size-3.5" />
        </button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoom(1 / ZOOM_STEP)} className={CONTROL_CLASS}>
          <Minus className="size-3.5" />
        </button>
        <button type="button" aria-label="Fit to screen" title="Fit to screen" onClick={() => setViewBox(fit)} className={CONTROL_CLASS}>
          <Maximize className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
