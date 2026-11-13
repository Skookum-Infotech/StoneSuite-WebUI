// @vitest-environment jsdom
// The floating Properties panel: there only while something is selected, so
// the board has the full width the rest of the time; deleting the piece from
// the panel hands keyboard focus to the canvas.

import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { InspectorPanel } from './InspectorPanel';

vi.mock('@/services/drawingService', () => ({ drawingService: { getEdgeCodes: vi.fn().mockResolvedValue([]) } }));

const drawing: Drawing = {
  schemaVersion: 1, salesOrderId: 'so1', version: 0, displayUnit: 'in', fractionDenominator: 32,
  areas: [{
    id: 'area-1', name: 'Area 1', code: '', sortOrder: 0, cabinets: [], notes: [],
    pieces: [{
      id: 'p1', label: 'A-1', shape: 'rect',
      outline: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: -400 }, { x: 0, y: -400 }],
      position: { x: 0, y: 0 }, rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
    }],
  }],
  updatedAt: '', updatedBy: { id: 'u', name: 'U' },
};

function Selector() {
  const { dispatch } = useDrawingEditor();
  return (
    <>
      <button type="button" onClick={() => dispatch({ type: 'selectPiece', pieceId: 'p1' })}>select</button>
      <button type="button" onClick={() => dispatch({ type: 'selectPiece', pieceId: null })}>deselect</button>
    </>
  );
}

function open() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DrawingEditorProvider drawing={drawing} materialLines={[]}>
        <div data-drawing-editor>
          <div role="application" aria-label="Drawing canvas" tabIndex={0} />
          <InspectorPanel />
          <Selector />
        </div>
      </DrawingEditorProvider>
    </QueryClientProvider>,
  );
}

const panel = () => screen.queryByRole('complementary', { name: 'Properties' });

describe('InspectorPanel', () => {
  it('is not there while nothing is selected', () => {
    open();
    expect(panel()).toBeNull();
  });

  it('floats over the board while a piece is selected and goes away when it is not', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'select' }));
    expect(panel()?.className).toContain('absolute');
    expect(screen.getByLabelText('Label')).toHaveValue('A-1');
    await userEvent.click(screen.getByRole('button', { name: 'deselect' }));
    expect(panel()).toBeNull();
  });

  it('deleting the piece from the panel moves keyboard focus to the canvas', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'select' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete A-1' }));
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('application', { name: 'Drawing canvas' }));
  });

  it('deselecting some other way leaves focus where it was', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'select' }));
    const deselect = screen.getByRole('button', { name: 'deselect' });
    await userEvent.click(deselect);
    expect(document.activeElement).toBe(deselect);
  });
});
