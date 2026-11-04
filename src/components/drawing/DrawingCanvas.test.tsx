import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';
import { ARROW_KEY_STEP_MM, SHIFT_ARROW_KEY_STEP_MM } from '@/lib/drawing/constants';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { DrawingCanvas } from './DrawingCanvas';

function drawingWithOnePiece(): Drawing {
  return {
    schemaVersion: 1,
    salesOrderId: 'so1',
    version: 0,
    displayUnit: 'in',
    fractionDenominator: 32,
    areas: [{
      id: 'area-1',
      name: 'Area 1',
      code: '',
      sortOrder: 0,
      cabinets: [],
      notes: [],
      pieces: [{
        id: 'p1',
        label: 'A-1',
        shape: 'rect',
        outline: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: -400 }, { x: 0, y: -400 }],
        position: { x: 0, y: 0 },
        rotationDeg: 0,
        thicknessMm: 30,
        edges: [],
        seams: [],
        cutouts: [],
      }],
    }],
    updatedAt: '2026-11-03T00:00:00.000Z',
    updatedBy: { id: 'u1', name: 'Test User' },
  };
}

/** Exposes the piece's live position/rotation and the area's piece count as
 *  plain text, so tests can assert on real reducer state instead of a
 *  dispatch mock. */
function Readout() {
  const { state } = useDrawingEditor();
  const piece = state.present.areas[0].pieces[0];
  return (
    <div>
      <span data-testid="pos-x">{piece?.position.x ?? 'none'}</span>
      <span data-testid="pos-y">{piece?.position.y ?? 'none'}</span>
      <span data-testid="rotation">{piece?.rotationDeg ?? 'none'}</span>
      <span data-testid="piece-count">{state.present.areas[0].pieces.length}</span>
    </div>
  );
}

function blankDrawing(): Drawing {
  return {
    schemaVersion: 1,
    salesOrderId: 'so1',
    version: 0,
    displayUnit: 'in',
    fractionDenominator: 32,
    areas: [{ id: 'area-1', name: 'Area 1', code: '', sortOrder: 0, pieces: [], cabinets: [], notes: [] }],
    updatedAt: '2026-11-03T00:00:00.000Z',
    updatedBy: { id: 'u1', name: 'Test User' },
  };
}

function PanZoomReadout() {
  const { state } = useDrawingEditor();
  return (
    <div>
      <span data-testid="pan-x">{state.pan.x}</span>
      <span data-testid="pan-y">{state.pan.y}</span>
    </div>
  );
}

function PolygonToolButton() {
  const { setTool } = useDrawingEditor();
  return <button type="button" onClick={() => setTool('polygon')}>polygon tool</button>;
}

function PieceOutlineReadout() {
  const { state } = useDrawingEditor();
  const piece = state.present.areas[0].pieces[0];
  return <span data-testid="outline">{piece ? JSON.stringify(piece.outline) : 'none'}</span>;
}

function mockSvgRect(width: number, height: number) {
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => undefined,
  } as DOMRect);
}

afterEach(() => {
  vi.restoreAllMocks();
});

function renderCanvas() {
  render(
    <DrawingEditorProvider drawing={drawingWithOnePiece()} materialLines={[]}>
      <DrawingCanvas />
      <Readout />
    </DrawingEditorProvider>,
  );
}

describe('DrawingCanvas keyboard handling', () => {
  it('ArrowRight with a piece selected moves it by ARROW_KEY_STEP_MM', async () => {
    renderCanvas();
    await userEvent.click(screen.getByRole('button', { name: /Piece A-1/ }));
    const canvas = screen.getByRole('application', { name: 'Drawing canvas' });
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    expect(Number(screen.getByTestId('pos-x').textContent)).toBeCloseTo(ARROW_KEY_STEP_MM, 5);
    expect(Number(screen.getByTestId('pos-y').textContent)).toBeCloseTo(0, 5);
  });

  it('Shift+ArrowRight with a piece selected moves it by SHIFT_ARROW_KEY_STEP_MM', async () => {
    renderCanvas();
    await userEvent.click(screen.getByRole('button', { name: /Piece A-1/ }));
    const canvas = screen.getByRole('application', { name: 'Drawing canvas' });
    fireEvent.keyDown(canvas, { key: 'ArrowRight', shiftKey: true });
    expect(Number(screen.getByTestId('pos-x').textContent)).toBeCloseTo(SHIFT_ARROW_KEY_STEP_MM, 5);
  });

  it('ArrowRight with nothing selected does not move anything', () => {
    renderCanvas();
    const canvas = screen.getByRole('application', { name: 'Drawing canvas' });
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    expect(Number(screen.getByTestId('pos-x').textContent)).toBe(0);
    expect(Number(screen.getByTestId('pos-y').textContent)).toBe(0);
  });

  it('Delete with a piece selected removes it', async () => {
    renderCanvas();
    await userEvent.click(screen.getByRole('button', { name: /Piece A-1/ }));
    const canvas = screen.getByRole('application', { name: 'Drawing canvas' });
    fireEvent.keyDown(canvas, { key: 'Delete' });
    expect(screen.getByTestId('piece-count').textContent).toBe('0');
  });

  it('"r" with a piece selected rotates it 90°', async () => {
    renderCanvas();
    await userEvent.click(screen.getByRole('button', { name: /Piece A-1/ }));
    const canvas = screen.getByRole('application', { name: 'Drawing canvas' });
    fireEvent.keyDown(canvas, { key: 'r' });
    expect(screen.getByTestId('rotation').textContent).toBe('90');
  });

  it('Delete returns keyboard focus to the canvas instead of stranding it when the focused piece is removed', async () => {
    renderCanvas();
    await userEvent.click(screen.getByRole('button', { name: /Piece A-1/ }));
    const canvas = screen.getByRole('application', { name: 'Drawing canvas' });
    fireEvent.keyDown(canvas, { key: 'Delete' });
    expect(document.activeElement).toBe(canvas);
  });

  it('exposes its keyboard shortcuts to assistive tech via aria-describedby', () => {
    renderCanvas();
    const canvas = screen.getByRole('application', { name: 'Drawing canvas' });
    const describedById = canvas.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();
    const description = document.getElementById(describedById as string);
    expect(description?.textContent).toMatch(/arrow key/i);
  });
});

describe('DrawingCanvas background pan — rendered size correction', () => {
  it('converts the same pixel drag to a different pan distance when the SVG renders at half size', () => {
    mockSvgRect(400, 300); // half of the 800x600 viewBox
    render(
      <DrawingEditorProvider drawing={blankDrawing()} materialLines={[]}>
        <DrawingCanvas />
        <PanZoomReadout />
      </DrawingEditorProvider>,
    );
    const background = screen.getByTestId('canvas-background');
    fireEvent.pointerDown(background, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(background, { pointerId: 1, clientX: 50, clientY: 0, movementX: 50, movementY: 0 });
    // 50px at a 400-wide rect (half-size) -> 100 viewbox units, not the 50
    // a naive 1px=1unit assumption would give.
    expect(Number(screen.getByTestId('pan-x').textContent)).toBeCloseTo(100, 5);
  });
});

describe('DrawingCanvas polygon tool', () => {
  it('places a clicked point at the correct world position, correcting for the SVG\'s actual rendered size', async () => {
    mockSvgRect(400, 300); // half of the 800x600 viewBox
    render(
      <DrawingEditorProvider drawing={blankDrawing()} materialLines={[]}>
        <DrawingCanvas />
        <PolygonToolButton />
        <PieceOutlineReadout />
      </DrawingEditorProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'polygon tool' }));
    const background = screen.getByTestId('canvas-background');
    // Clicked in clockwise order (this app's convention), so winding
    // normalization doesn't reorder them — isolates placement from that
    // separate behavior (covered by its own test below).
    fireEvent.pointerDown(background, { clientX: 200, clientY: 150 }); // rendered center -> world (0,0)
    fireEvent.pointerDown(background, { clientX: 200, clientY: 100 }); // 50px up at half-size -> world (0,100)
    fireEvent.pointerDown(background, { clientX: 250, clientY: 150 }); // 50px right at half-size -> world (100,0)
    fireEvent.doubleClick(background);
    const outline = JSON.parse(screen.getByTestId('outline').textContent ?? 'null');
    expect(outline).toHaveLength(3);
    expect(outline[0]).toMatchObject({ x: 0, y: 0 });
    expect(outline[1]).toMatchObject({ x: 0, y: 100 });
  });

  it('normalizes a counter-clockwise click order to the app\'s clockwise convention', async () => {
    mockSvgRect(800, 600);
    render(
      <DrawingEditorProvider drawing={blankDrawing()} materialLines={[]}>
        <DrawingCanvas />
        <PolygonToolButton />
        <PieceOutlineReadout />
      </DrawingEditorProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'polygon tool' }));
    const background = screen.getByTestId('canvas-background');
    // Clicked counter-clockwise (this app's convention): (0,0) -> (100,0)
    // -> (100,100) -> (0,100).
    fireEvent.pointerDown(background, { clientX: 400, clientY: 300 });
    fireEvent.pointerDown(background, { clientX: 500, clientY: 300 });
    fireEvent.pointerDown(background, { clientX: 500, clientY: 200 });
    fireEvent.pointerDown(background, { clientX: 400, clientY: 200 });
    fireEvent.doubleClick(background);
    const outline = JSON.parse(screen.getByTestId('outline').textContent ?? 'null');
    // Reversed to clockwise: the same 4 points, wound the other way.
    expect(outline[0]).toMatchObject({ x: 0, y: 100 });
    expect(outline[1]).toMatchObject({ x: 100, y: 100 });
    expect(outline[3]).toMatchObject({ x: 0, y: 0 });
  });

  it('drops a duplicate point from a double-click\'s extra pointerdown instead of adding a zero-length edge', async () => {
    mockSvgRect(800, 600);
    render(
      <DrawingEditorProvider drawing={blankDrawing()} materialLines={[]}>
        <DrawingCanvas />
        <PolygonToolButton />
        <PieceOutlineReadout />
      </DrawingEditorProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'polygon tool' }));
    const background = screen.getByTestId('canvas-background');
    fireEvent.pointerDown(background, { clientX: 400, clientY: 300 });
    fireEvent.pointerDown(background, { clientX: 500, clientY: 300 });
    fireEvent.pointerDown(background, { clientX: 500, clientY: 200 });
    // A double-click's second pointerdown lands on (nearly) the same spot.
    fireEvent.pointerDown(background, { clientX: 500, clientY: 200 });
    fireEvent.doubleClick(background);
    const outline = JSON.parse(screen.getByTestId('outline').textContent ?? 'null');
    expect(outline).toHaveLength(3);
  });
});
