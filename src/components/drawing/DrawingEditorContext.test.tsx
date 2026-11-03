import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';
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
