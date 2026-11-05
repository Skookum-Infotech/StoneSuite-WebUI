// @vitest-environment jsdom
// Phase 4: per-side profile / overhang / backsplash / waterfall through the real inspector and reducer.

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Drawing, Piece } from '@/types/drawing';
import { rectOutline } from '@/lib/drawing/geometry';

vi.mock('@/services/drawingService', () => ({
  drawingService: { getEdgeCodes: vi.fn().mockResolvedValue([{ code: 'EE', label: 'Eased Edge' }, { code: 'BN', label: 'Bullnose' }]) },
}));
vi.mock('@/services/inventoryService', () => ({ inventoryService: { getItem: vi.fn() } }));
vi.mock('@/components/inventory/ItemPicker', () => ({ ItemPicker: () => <div /> }));

import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { PieceInspector } from './PieceInspector';
import { PieceDimensions } from './PieceDimensions';

const base: Piece = {
  id: 'p1', label: 'A-1', shape: 'rect', outline: rectOutline(2000, 800), position: { x: 0, y: 0 }, rotationDeg: 0,
  thicknessMm: 30, edges: [], seams: [], cutouts: [],
};
const drawing: Drawing = {
  schemaVersion: 1, salesOrderId: 'so1', version: 0, displayUnit: 'mm', fractionDenominator: 32,
  areas: [{ id: 'a', name: 'A', code: '', sortOrder: 0, pieces: [base], cabinets: [], notes: [] }],
  updatedAt: '2026-11-05T00:00:00.000Z', updatedBy: { id: 'u1', name: 'T' },
};

function Harness() {
  const { state, dispatch } = useDrawingEditor();
  const piece = state.present.areas[0].pieces[0];
  return (
    <>
      <button type="button" onClick={() => dispatch({ type: 'selectPiece', pieceId: 'p1' })}>select</button>
      <PieceInspector />
      <svg><PieceDimensions piece={piece} displayUnit="mm" fractionDenominator={32} /></svg>
      <span data-testid="edges">{JSON.stringify(piece.edges)}</span>
    </>
  );
}

async function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DrawingEditorProvider drawing={drawing} materialLines={[]}><Harness /></DrawingEditorProvider>
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'select' }));
  return user;
}

const edges = () => JSON.parse(screen.getByTestId('edges').textContent ?? '[]');

describe('side settings', () => {
  it('sets a profile from the tenant list and draws its code on the side', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Select side A' }));
    await screen.findAllByRole('option', { name: 'Bullnose' });
    await user.selectOptions(screen.getByLabelText('Side A edge profile'), 'BN');
    expect(edges()).toEqual([{ index: 0, code: 'BN' }]);
    expect(screen.getByText('BN')).toBeTruthy();
  });

  it('stores a backsplash height in millimetres and clears it when set to 0', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Select side A' }));
    const field = screen.getByLabelText('Side A backsplash height');
    await user.clear(field);
    await user.type(field, '100mm');
    await user.tab();
    expect(edges()).toEqual([{ index: 0, splashHeightMm: 100 }]);
    await user.clear(field);
    await user.type(field, '0');
    await user.tab();
    expect(edges()).toEqual([]);
  });

  it('refuses a negative waterfall height and keeps the message next to the field', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Select side B' }));
    const field = screen.getByLabelText('Side B waterfall height');
    await user.clear(field);
    await user.type(field, '-5');
    await user.tab();
    expect(screen.getByRole('alert').textContent).toContain("isn't a length");
    expect(edges()).toEqual([]);
  });
});
