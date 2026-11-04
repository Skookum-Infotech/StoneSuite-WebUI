import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing, Piece } from '@/types/drawing';
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH, ZOOM_MAX } from '@/lib/drawing/constants';
import { rectOutline } from '@/lib/drawing/geometry';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';

const DRAWING: Drawing = {
  schemaVersion: 1,
  salesOrderId: 'so1',
  version: 0,
  displayUnit: 'in',
  fractionDenominator: 32,
  areas: [{ id: 'area-1', name: 'Area 1', code: '', sortOrder: 0, pieces: [], cabinets: [], notes: [] }],
  updatedAt: '2026-11-03T00:00:00.000Z',
  updatedBy: { id: 'u1', name: 'Test User' },
};

function Consumer() {
  const { state, dispatch } = useDrawingEditor();
  return (
    <div>
      <span>areas: {state.present.areas.length}</span>
      <button type="button" onClick={() => dispatch({ type: 'addArea', name: 'Kitchen' })}>
        Add area
      </button>
    </div>
  );
}

describe('DrawingEditorProvider / useDrawingEditor', () => {
  it('dispatching through context updates every consumer', async () => {
    render(
      <DrawingEditorProvider drawing={DRAWING} materialLines={[]}>
        <Consumer />
      </DrawingEditorProvider>,
    );
    expect(screen.getByText('areas: 1')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Add area' }));
    expect(screen.getByText('areas: 2')).toBeDefined();
  });

  it('throws when used outside a DrawingEditorProvider', () => {
    expect(() => render(<Consumer />)).toThrow();
  });
});

function makePiece(id: string, outline: Piece['outline'], position: Piece['position'] = { x: 0, y: 0 }): Piece {
  return {
    id, label: id, shape: 'rect', outline, position, rotationDeg: 0, thicknessMm: 30,
    edges: [], seams: [], cutouts: [],
  };
}

function ZoomPanReadout() {
  const { state, fitToArea } = useDrawingEditor();
  return (
    <div>
      <span data-testid="zoom">{state.zoom}</span>
      <span data-testid="pan-x">{state.pan.x}</span>
      <span data-testid="pan-y">{state.pan.y}</span>
      <button type="button" onClick={fitToArea}>fit</button>
    </div>
  );
}

describe('fitToArea', () => {
  it('resets to zoom 1 and pan {0,0} when the active area has no pieces', async () => {
    render(
      <DrawingEditorProvider
        drawing={{ ...DRAWING, areas: [{ ...DRAWING.areas[0], pieces: [] }] }}
        materialLines={[]}
      >
        <ZoomPanReadout />
      </DrawingEditorProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'fit' }));
    expect(screen.getByTestId('zoom').textContent).toBe('1');
    expect(screen.getByTestId('pan-x').textContent).toBe('0');
    expect(screen.getByTestId('pan-y').textContent).toBe('0');
  });

  it('centers the content on screen — a piece sitting off-center must land back at the viewport center, not off-screen', async () => {
    // A 600x400mm piece placed well away from the world origin.
    const piece = makePiece('p1', rectOutline(600, 400), { x: 1000, y: -2000 });
    render(
      <DrawingEditorProvider
        drawing={{ ...DRAWING, areas: [{ ...DRAWING.areas[0], pieces: [piece] }] }}
        materialLines={[]}
      >
        <ZoomPanReadout />
      </DrawingEditorProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'fit' }));

    const zoom = Number(screen.getByTestId('zoom').textContent);
    const panX = Number(screen.getByTestId('pan-x').textContent);
    const panY = Number(screen.getByTestId('pan-y').textContent);

    // The piece's world-space bounds center, mapped through the exact same
    // transform DrawingCanvas renders with, must land at the viewport's own
    // center (VIEWPORT_WIDTH/2, VIEWPORT_HEIGHT/2) — i.e. at screen offset
    // (0, 0) from that center once the canvas's own translate(400,300) is
    // factored out.
    const worldCenterX = 1000 + 300; // piece position + half its 600mm length
    const worldCenterY = -2000 - 200; // piece position + half its -400mm width
    const screenOffsetX = panX + zoom * worldCenterX;
    const screenOffsetY = panY - zoom * worldCenterY;
    expect(screenOffsetX).toBeCloseTo(0, 5);
    expect(screenOffsetY).toBeCloseTo(0, 5);
  });

  it('scales zoom down so a piece larger than the viewport actually fits inside it', async () => {
    // Bigger than the 800x600 viewBox at zoom 1, but still well within the
    // 25%-400% zoom range the spec fixes — a 96" x 60" island.
    const lengthMm = 96 * 25.4;
    const widthMm = 60 * 25.4;
    const piece = makePiece('p1', rectOutline(lengthMm, widthMm));
    render(
      <DrawingEditorProvider
        drawing={{ ...DRAWING, areas: [{ ...DRAWING.areas[0], pieces: [piece] }] }}
        materialLines={[]}
      >
        <ZoomPanReadout />
      </DrawingEditorProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'fit' }));
    const zoom = Number(screen.getByTestId('zoom').textContent);
    expect(zoom).toBeLessThan(1);
    expect(zoom * lengthMm).toBeLessThanOrEqual(VIEWPORT_WIDTH);
    expect(zoom * widthMm).toBeLessThanOrEqual(VIEWPORT_HEIGHT);
  });

  it('clamps to ZOOM_MIN for content too large to fit even at the 25% floor, rather than under- or over-shooting it', async () => {
    // A 12ft U-shape — larger than the viewport can show even at 25% zoom
    // (the spec's own floor). "Fit" can only get as close as that floor
    // allows; it must not pick something smaller or larger than it.
    const piece = makePiece('p1', rectOutline(300 * 25.4, 200 * 25.4));
    render(
      <DrawingEditorProvider
        drawing={{ ...DRAWING, areas: [{ ...DRAWING.areas[0], pieces: [piece] }] }}
        materialLines={[]}
      >
        <ZoomPanReadout />
      </DrawingEditorProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'fit' }));
    expect(screen.getByTestId('zoom').textContent).toBe('0.25');
  });

  it('never zooms in past ZOOM_MAX for a tiny piece', async () => {
    const piece = makePiece('p1', rectOutline(5, 5));
    render(
      <DrawingEditorProvider
        drawing={{ ...DRAWING, areas: [{ ...DRAWING.areas[0], pieces: [piece] }] }}
        materialLines={[]}
      >
        <ZoomPanReadout />
      </DrawingEditorProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'fit' }));
    expect(Number(screen.getByTestId('zoom').textContent)).toBeLessThanOrEqual(ZOOM_MAX);
  });
});
