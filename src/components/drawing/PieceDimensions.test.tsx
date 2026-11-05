// @vitest-environment jsdom
// The measurements as they appear on the drawing: one lettered dimension per
// side, and text that keeps its on-screen size when the view is zoomed out to
// fit a large piece.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing, Piece } from '@/types/drawing';
import { rectOutline } from '@/lib/drawing/geometry';
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
  return <button type="button" onClick={() => dispatch({ type: 'setZoom', zoom: 0.25 })}>zoom out</button>;
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

  it('counter-scales the text so it stays legible when the view is zoomed out', async () => {
    const user = show();
    const before = Number(texts()[0].getAttribute('font-size'));
    await user.click(screen.getByRole('button', { name: 'zoom out' }));
    const after = Number(texts()[0].getAttribute('font-size'));
    // A quarter of the zoom means four times the world font size — the same
    // number of pixels on screen either way.
    expect(after).toBeCloseTo(before * 4);
  });

  it('draws an extension line and an end tick for every dimension, not just a bare line', () => {
    show();
    // 4 sides x (2 extension + 1 dimension + 2 ticks)
    expect(screen.getByTestId('canvas').querySelectorAll('line')).toHaveLength(20);
  });
});
