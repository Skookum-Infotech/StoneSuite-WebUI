import { describe, expect, it } from 'vitest';
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
});
