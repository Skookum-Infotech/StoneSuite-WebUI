import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';
import { MM_PER_INCH } from '@/lib/drawing/constants';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { DrawingToolbar } from './DrawingToolbar';

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

/** Exposes the active area's pieces and the undo/redo history depth as
 *  plain text/JSON, so tests assert on real reducer state. */
function Readout() {
  const { state } = useDrawingEditor();
  const area = state.present.areas[0];
  return (
    <div>
      <span data-testid="pieces">{JSON.stringify(area.pieces.map((p) => ({ outline: p.outline, thicknessMm: p.thicknessMm, label: p.label })))}</span>
      <span data-testid="past-length">{state.past.length}</span>
      <span data-testid="future-length">{state.future.length}</span>
    </div>
  );
}

function renderToolbar() {
  render(
    <DrawingEditorProvider drawing={blankDrawing()} materialLines={[]}>
      <DrawingToolbar />
      <Readout />
    </DrawingEditorProvider>,
  );
}

describe('DrawingToolbar — add rectangle', () => {
  it('reveals Length/Width/Thickness inputs after clicking "Add rectangle"', async () => {
    renderToolbar();
    await userEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    expect(screen.getByLabelText('Length')).toBeDefined();
    expect(screen.getByLabelText('Width')).toBeDefined();
    expect(screen.getByLabelText('Thickness')).toBeDefined();
  });

  it('submitting valid Length/Width/Thickness adds a piece with the matching outline and thickness', async () => {
    renderToolbar();
    await userEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    await userEvent.type(screen.getByLabelText('Length'), '96');
    await userEvent.type(screen.getByLabelText('Width'), '26');
    await userEvent.type(screen.getByLabelText('Thickness'), '1.25');
    await userEvent.click(screen.getByRole('button', { name: 'Add piece' }));

    const pieces = JSON.parse(screen.getByTestId('pieces').textContent ?? '[]');
    expect(pieces).toHaveLength(1);
    expect(pieces[0].thicknessMm).toBeCloseTo(1.25 * MM_PER_INCH, 5);
    expect(pieces[0].outline).toEqual([
      { x: 0, y: 0 },
      { x: 96 * MM_PER_INCH, y: 0 },
      { x: 96 * MM_PER_INCH, y: -26 * MM_PER_INCH },
      { x: 0, y: -26 * MM_PER_INCH },
    ]);
    expect(pieces[0].label).toBe('A-1');
  });

  it('shows the parse error inline and does not add a piece when Length is invalid', async () => {
    renderToolbar();
    await userEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    await userEvent.type(screen.getByLabelText('Length'), 'banana');
    await userEvent.type(screen.getByLabelText('Width'), '26');
    await userEvent.type(screen.getByLabelText('Thickness'), '1.25');
    await userEvent.click(screen.getByRole('button', { name: 'Add piece' }));

    expect(screen.getByText(/isn't a length/)).toBeDefined();
    expect(JSON.parse(screen.getByTestId('pieces').textContent ?? '[]')).toHaveLength(0);
  });
});

describe('DrawingToolbar — undo/redo', () => {
  it('Undo is disabled with no history, enabled and working after an edit; Redo mirrors it', async () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    await userEvent.type(screen.getByLabelText('Length'), '96');
    await userEvent.type(screen.getByLabelText('Width'), '26');
    await userEvent.type(screen.getByLabelText('Thickness'), '1.25');
    await userEvent.click(screen.getByRole('button', { name: 'Add piece' }));
    expect(JSON.parse(screen.getByTestId('pieces').textContent ?? '[]')).toHaveLength(1);

    const undoButton = screen.getByRole('button', { name: 'Undo' });
    expect(undoButton).toBeEnabled();
    await userEvent.click(undoButton);
    expect(JSON.parse(screen.getByTestId('pieces').textContent ?? '[]')).toHaveLength(0);

    const redoButton = screen.getByRole('button', { name: 'Redo' });
    expect(redoButton).toBeEnabled();
    await userEvent.click(redoButton);
    expect(JSON.parse(screen.getByTestId('pieces').textContent ?? '[]')).toHaveLength(1);
  });
});
