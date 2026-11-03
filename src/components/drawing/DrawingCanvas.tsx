// The editor's SVG viewport: grid, pan/zoom, every piece + its dimension
// lines for the active area, and the keyboard shortcuts that act on the
// current selection. See this task's plan brief for the pixel/world
// convention: viewBox "0 0 800 600", origin centered at (400,300), 1 SVG
// unit = 1mm before the zoom scale.

import { useState } from 'react';
import type { Point } from '@/types/drawing';
import { transformOutline } from '@/lib/drawing/geometry';
import { layoutEdgeDimensions } from '@/lib/drawing/dimensions';
import { areaLetter, nextPieceLabel } from '@/lib/drawing/labels';
import { ARROW_KEY_STEP_MM, GRID_SIZE_MM, SHIFT_ARROW_KEY_STEP_MM, ZOOM_STEP } from '@/lib/drawing/constants';
import { useDrawingEditor } from './DrawingEditorContext';
import { PieceShape } from './PieceShape';
import { DimensionLine } from './DimensionLine';

const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 600;
const VIEWPORT_CENTER_X = VIEWPORT_WIDTH / 2;
const VIEWPORT_CENTER_Y = VIEWPORT_HEIGHT / 2;

export function DrawingCanvas() {
  const { state, dispatch, tool, setTool } = useDrawingEditor();
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [isPanning, setIsPanning] = useState(false);

  const activeArea = state.present.areas.find((a) => a.id === state.activeAreaId);
  const areaIndex = state.present.areas.findIndex((a) => a.id === state.activeAreaId);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const pieceId = state.selectedPieceId;
    if (e.key === 'Enter' && tool === 'polygon' && draftPoints.length >= 3) {
      finalizePolygon();
      return;
    }
    if (!pieceId) return;
    const step = e.shiftKey ? SHIFT_ARROW_KEY_STEP_MM : ARROW_KEY_STEP_MM;
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        dispatch({ type: 'movePiece', areaId: state.activeAreaId, pieceId, delta: { x: step, y: 0 } });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        dispatch({ type: 'movePiece', areaId: state.activeAreaId, pieceId, delta: { x: -step, y: 0 } });
        break;
      case 'ArrowUp':
        e.preventDefault();
        dispatch({ type: 'movePiece', areaId: state.activeAreaId, pieceId, delta: { x: 0, y: step } });
        break;
      case 'ArrowDown':
        e.preventDefault();
        dispatch({ type: 'movePiece', areaId: state.activeAreaId, pieceId, delta: { x: 0, y: -step } });
        break;
      case 'Delete':
      case 'Backspace':
        dispatch({ type: 'deletePiece', areaId: state.activeAreaId, pieceId });
        break;
      case 'r':
        dispatch({ type: 'rotatePiece', areaId: state.activeAreaId, pieceId });
        break;
      default:
        break;
    }
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    dispatch({ type: 'setZoom', zoom: state.zoom * (e.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP) });
  };

  const screenToMm = (clientX: number, clientY: number, rect: DOMRect): Point => ({
    x: (clientX - rect.left - VIEWPORT_CENTER_X - state.pan.x) / state.zoom,
    y: -(clientY - rect.top - VIEWPORT_CENTER_Y - state.pan.y) / state.zoom,
  });

  const onBackgroundPointerDown = (e: React.PointerEvent<SVGRectElement>) => {
    if (tool === 'polygon') {
      const svg = e.currentTarget.ownerSVGElement;
      if (!svg) return;
      setDraftPoints((points) => [...points, screenToMm(e.clientX, e.clientY, svg.getBoundingClientRect())]);
      return;
    }
    setIsPanning(true);
    // jsdom (tests) doesn't implement pointer capture on SVG elements; every
    // real browser does.
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onBackgroundPointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (!isPanning) return;
    dispatch({ type: 'pan', delta: { x: e.movementX, y: e.movementY } });
  };

  const onBackgroundPointerUp = () => setIsPanning(false);

  const onBackgroundDoubleClick = () => {
    if (tool === 'polygon' && draftPoints.length >= 3) finalizePolygon();
  };

  function finalizePolygon() {
    if (!activeArea) return;
    dispatch({
      type: 'addPiece',
      areaId: state.activeAreaId,
      piece: {
        id: crypto.randomUUID(),
        label: nextPieceLabel(areaLetter(areaIndex), activeArea.pieces.map((p) => p.label)),
        shape: 'polygon',
        outline: draftPoints,
        position: { x: 0, y: 0 },
        rotationDeg: 0,
        thicknessMm: 30,
        edges: [],
        seams: [],
        cutouts: [],
      },
    });
    setDraftPoints([]);
    setTool('select');
  }

  return (
    <div
      role="application"
      aria-label="Drawing canvas"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      className="outline-none"
    >
      <svg viewBox={`0 0 ${VIEWPORT_WIDTH} ${VIEWPORT_HEIGHT}`} width="100%" height="100%">
        <defs>
          <pattern id="drawing-grid" width={GRID_SIZE_MM} height={GRID_SIZE_MM} patternUnits="userSpaceOnUse">
            <path d={`M 0 0 L 0 ${GRID_SIZE_MM} M 0 0 L ${GRID_SIZE_MM} 0`} className="stroke-stone-200" strokeWidth={0.5} />
          </pattern>
        </defs>
        <g transform={`translate(${VIEWPORT_CENTER_X},${VIEWPORT_CENTER_Y})`}>
          <g transform={`translate(${state.pan.x},${state.pan.y}) scale(${state.zoom})`}>
            <rect
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
            {activeArea?.pieces.map((piece) => {
              const worldOutline = transformOutline(piece.outline, piece.position, piece.rotationDeg);
              return (
                <g key={piece.id}>
                  {layoutEdgeDimensions(worldOutline).map((layout, i) => (
                    // Index key: edges have no stable id of their own, and
                    // this list is rebuilt fresh from the piece every render.
                    <DimensionLine
                      key={i}
                      layout={layout}
                      displayUnit={state.present.displayUnit}
                      fractionDenominator={state.present.fractionDenominator}
                    />
                  ))}
                  <PieceShape piece={piece} selected={piece.id === state.selectedPieceId} />
                </g>
              );
            })}
            {tool === 'polygon' && draftPoints.length > 0 && (
              <polyline
                points={draftPoints.map((p) => `${p.x},${-p.y}`).join(' ')}
                fill="none"
                className="stroke-brand"
                strokeDasharray="4 4"
                aria-hidden="true"
              />
            )}
          </g>
        </g>
      </svg>
    </div>
  );
}
