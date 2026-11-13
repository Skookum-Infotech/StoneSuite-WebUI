// @vitest-environment jsdom
// The floating Properties panel: off by default, opened and closed only by
// the `propertiesOpen` toggle (the bottom bar's own Properties button) —
// selecting or deselecting a piece never opens or closes it on its own,
// only changes what it shows while it's already open.

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

function Controls() {
  const { dispatch, propertiesOpen, toggleProperties } = useDrawingEditor();
  return (
    <>
      <button type="button" onClick={() => dispatch({ type: 'selectPiece', pieceId: 'p1' })}>select</button>
      <button type="button" onClick={() => dispatch({ type: 'selectPiece', pieceId: null })}>deselect</button>
      <button type="button" onClick={toggleProperties}>toggle properties</button>
      <span data-testid="properties-open">{String(propertiesOpen)}</span>
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
          <Controls />
        </div>
      </DrawingEditorProvider>
    </QueryClientProvider>,
  );
}

const panel = () => screen.queryByRole('complementary', { name: 'Properties' });
const toggle = () => screen.getByRole('button', { name: 'toggle properties' });

describe('InspectorPanel', () => {
  it('is not there by default, even with a piece selected', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'select' }));
    expect(panel()).toBeNull();
  });

  it('only the toggle opens or closes it — selecting and deselecting a piece do nothing to it', async () => {
    open();
    await userEvent.click(toggle());
    expect(panel()?.className).toContain('absolute');
    await userEvent.click(screen.getByRole('button', { name: 'select' }));
    expect(panel()).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'deselect' }));
    expect(panel()).not.toBeNull();
    await userEvent.click(toggle());
    expect(panel()).toBeNull();
  });

  it('shows the selected piece\'s fields while open, and "No piece selected" otherwise', async () => {
    open();
    await userEvent.click(toggle());
    expect(screen.getByText(/no piece selected/i)).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'select' }));
    expect(screen.getByLabelText('Label')).toHaveValue('A-1');
  });

  it('deleting the piece while the panel is open leaves the panel open, showing "No piece selected"', async () => {
    open();
    await userEvent.click(toggle());
    await userEvent.click(screen.getByRole('button', { name: 'select' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete A-1' }));
    expect(panel()).not.toBeNull();
    expect(screen.getByText(/no piece selected/i)).toBeDefined();
  });
});
