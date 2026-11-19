// @vitest-environment jsdom
// The measurements as they appear on the drawing: one lettered dimension per
// side, and text that keeps its on-screen size when the view is zoomed out to
// fit a large piece.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing, Piece } from '@/types/drawing';
import { DIMENSION_OFFSET_PX, TEXT_SCALE_FLOOR_ZOOM, ZOOM_MAX } from '@/lib/drawing/constants';
import { circleOutline, rectOutline } from '@/lib/drawing/geometry';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { PieceDimensions } from './PieceDimensions';

const piece: Piece = {
  id: 'p1', label: 'A-1', shape: 'rect', outline: rectOutline(2540, 1270), position: { x: 0, y: 0 },
  rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
};

const drawing: Drawing = {
  schemaVersion: 1, salesOrderId: 's', version: 0, displayUnit: 'in', fractionDenominator: 32,
  areas: [{ id: 'a', name: 'A', code: '', sortOrder: 0, pieces: [piece], cabinets: [], notes: [] }],
  updatedAt: '', updatedBy: { id: 'u', name: 'U' },
};

function ZoomOut() {
  const { dispatch } = useDrawingEditor();
  const zoomTo = (zoom: number) => dispatch({ type: 'setZoom', zoom });
  return (
    <>
      <button type="button" onClick={() => zoomTo(0.5)}>zoom out</button>
      <button type="button" onClick={() => zoomTo(ZOOM_MAX)}>zoom in</button>
      <button type="button" onClick={() => zoomTo(TEXT_SCALE_FLOOR_ZOOM)}>zoom to floor</button>
      <button type="button" onClick={() => zoomTo(TEXT_SCALE_FLOOR_ZOOM / 4)}>zoom past floor</button>
    </>
  );
}

function show() {
  render(
    <DrawingEditorProvider drawing={drawing} materialLines={[]}>
      <ZoomOut />
      <svg data-testid="canvas">
        <PieceDimensions piece={piece} displayUnit="in" fractionDenominator={32} />
      </svg>
    </DrawingEditorProvider>,
  );
  return userEvent.setup();
}

const texts = () => Array.from(screen.getByTestId('canvas').querySelectorAll('text'));

describe('PieceDimensions', () => {
  it('letters each side and shows its length, matching the inspector\'s Sides list', () => {
    show();
    expect(texts().map((t) => t.textContent)).toEqual(['A: 100"', 'B: 50"', 'C: 100"', 'D: 50"']);
  });

  it('counter-scales the text so it stays legible across the normal editing range', async () => {
    const user = show();
    const before = Number(texts()[0].getAttribute('font-size'));
    await user.click(screen.getByRole('button', { name: 'zoom out' }));
    const after = Number(texts()[0].getAttribute('font-size'));
    // Half the zoom means twice the world font size — the same number of
    // pixels on screen either way.
    expect(after).toBeCloseTo(before * 2);
  });

  it('lets the text shrink with the drawing once zoomed out past TEXT_SCALE_FLOOR_ZOOM, instead of piling up at a constant size', async () => {
    const user = show();
    const screenPx = (zoom: number) => Number(texts()[0].getAttribute('font-size')) * zoom;
    await user.click(screen.getByRole('button', { name: 'zoom to floor' }));
    const atFloor = screenPx(TEXT_SCALE_FLOOR_ZOOM);
    await user.click(screen.getByRole('button', { name: 'zoom past floor' }));
    const pastFloor = screenPx(TEXT_SCALE_FLOOR_ZOOM / 4);
    // Above/at the floor the on-screen size is constant; a quarter of the
    // zoom below it means a quarter of the on-screen size too, same as every
    // other piece of geometry on the canvas.
    expect(pastFloor).toBeCloseTo(atFloor / 4);
  });

  it('stands the dimension line the same on-screen distance off the piece across the normal editing range, in or out', async () => {
    const user = show();
    const extensionPx = (zoom: number) => {
      // The first line drawn is a side's extension line, corner -> dimension
      // line, so its on-screen length is the stand-off the user sees.
      const line = screen.getByTestId('canvas').querySelector('line') as SVGLineElement;
      const worldLength = Math.hypot(
        Number(line.getAttribute('x2')) - Number(line.getAttribute('x1')),
        Number(line.getAttribute('y2')) - Number(line.getAttribute('y1')),
      );
      return worldLength * zoom;
    };
    expect(extensionPx(1)).toBeCloseTo(DIMENSION_OFFSET_PX);
    await user.click(screen.getByRole('button', { name: 'zoom out' }));
    expect(extensionPx(0.5)).toBeCloseTo(DIMENSION_OFFSET_PX);
    await user.click(screen.getByRole('button', { name: 'zoom in' }));
    expect(extensionPx(ZOOM_MAX)).toBeCloseTo(DIMENSION_OFFSET_PX);
  });

  it('shrinks the dimension line\'s stand-off below TEXT_SCALE_FLOOR_ZOOM too, so it does not drift away from a piece that has itself shrunk', async () => {
    const user = show();
    const extensionScreenPx = (zoom: number) => {
      const line = screen.getByTestId('canvas').querySelector('line') as SVGLineElement;
      const worldLength = Math.hypot(
        Number(line.getAttribute('x2')) - Number(line.getAttribute('x1')),
        Number(line.getAttribute('y2')) - Number(line.getAttribute('y1')),
      );
      return worldLength * zoom;
    };
    await user.click(screen.getByRole('button', { name: 'zoom past floor' }));
    expect(extensionScreenPx(TEXT_SCALE_FLOOR_ZOOM / 4)).toBeCloseTo(DIMENSION_OFFSET_PX / 4);
  });

  it('sits each measurement on its line with a white halo', () => {
    show();
    const text = texts()[0];
    expect(text.getAttribute('paint-order')).toBe('stroke');
    expect(text.getAttribute('class')).toContain('stroke-white');
  });

  it('keeps every measurement visible when zoomed far out, even on a small piece', async () => {
    const user = show();
    const tiny: Piece = { ...piece, outline: rectOutline(100, 50) };
    render(
      <DrawingEditorProvider drawing={drawing} materialLines={[]}>
        <ZoomOut />
        <svg data-testid="tiny"><PieceDimensions piece={tiny} displayUnit="in" fractionDenominator={32} /></svg>
      </DrawingEditorProvider>,
    );
    await user.click(screen.getAllByRole('button', { name: 'zoom out' })[1]);
    expect(screen.getByTestId('tiny').querySelectorAll('text')).toHaveLength(4);
  });

  it('draws each side as a joined bracket: two extension lines and a two-half dimension line, all dashed, with no end ticks', () => {
    show();
    const lines = Array.from(screen.getByTestId('canvas').querySelectorAll('line'));
    // 4 sides x (2 extension + 2 dimension-line halves)
    expect(lines).toHaveLength(16);
    for (const line of lines) {
      expect(line.getAttribute('stroke-dasharray')).toBeTruthy();
      // Square caps close the notch where an extension meets the dimension line.
      expect(line.getAttribute('stroke-linecap')).toBe('square');
    }
  });

  it('starts every dashed segment at a bracket corner, so each corner opens on a dash and reads as joined', () => {
    show();
    const lines = Array.from(screen.getByTestId('canvas').querySelectorAll('line'));
    for (let side = 0; side < 4; side += 1) {
      const [extA, extB, halfA, halfB] = lines.slice(side * 4, side * 4 + 4);
      expect(halfA.getAttribute('x1')).toBe(extA.getAttribute('x1'));
      expect(halfA.getAttribute('y1')).toBe(extA.getAttribute('y1'));
      expect(halfB.getAttribute('x1')).toBe(extB.getAttribute('x1'));
      expect(halfB.getAttribute('y1')).toBe(extB.getAttribute('y1'));
    }
  });

  it('marks each measured corner with a dot that keeps its on-screen size', async () => {
    const user = show();
    const dots = () => Array.from(screen.getByTestId('canvas').querySelectorAll('circle'));
    expect(dots()).toHaveLength(8);
    const before = Number(dots()[0].getAttribute('r'));
    await user.click(screen.getByRole('button', { name: 'zoom out' }));
    expect(Number(dots()[0].getAttribute('r'))).toBeCloseTo(before * 2);
  });
});

describe('PieceDimensions — a circle', () => {
  // 5" radius, 10" across.
  const circlePiece: Piece = {
    id: 'c1', label: 'C-1', shape: 'circle', radiusMm: 127, outline: circleOutline(127), position: { x: 0, y: 0 },
    rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
  };
  const circleDrawing: Drawing = {
    schemaVersion: 1, salesOrderId: 's', version: 0, displayUnit: 'in', fractionDenominator: 32,
    areas: [{ id: 'a', name: 'A', code: '', sortOrder: 0, pieces: [circlePiece], cabinets: [], notes: [] }],
    updatedAt: '', updatedBy: { id: 'u', name: 'U' },
  };

  function showCircle() {
    render(
      <DrawingEditorProvider drawing={circleDrawing} materialLines={[]}>
        <svg data-testid="canvas"><PieceDimensions piece={circlePiece} displayUnit="in" fractionDenominator={32} /></svg>
      </DrawingEditorProvider>,
    );
  }

  it('shows exactly 3 dimensions — top width, bottom width, and the radius — not one per outline point', () => {
    showCircle();
    expect(texts().map((t) => t.textContent)).toEqual(['A: 10"', 'B: 10"', 'C: 5"']);
  });

  it('stays centred on the piece\'s position regardless of rotationDeg', () => {
    render(
      <DrawingEditorProvider drawing={circleDrawing} materialLines={[]}>
        <svg data-testid="rotated">
          <PieceDimensions piece={{ ...circlePiece, rotationDeg: 37 }} displayUnit="in" fractionDenominator={32} />
        </svg>
      </DrawingEditorProvider>,
    );
    const rotatedTexts = Array.from(screen.getByTestId('rotated').querySelectorAll('text'));
    expect(rotatedTexts.map((t) => t.textContent)).toEqual(['A: 10"', 'B: 10"', 'C: 5"']);
  });
});
