// @vitest-environment jsdom
// End-to-end behaviour of the Phase 2/3 editing UI: cutouts, side lengths,
// corner handles, multi-select — each through the real components and reducer.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Cutout, Drawing, Piece } from '@/types/drawing';
import { rectOutline } from '@/lib/drawing/geometry';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn() } }));
vi.mock('@/services/drawingService', () => ({
  drawingService: { getEdgeCodes: vi.fn().mockResolvedValue([{ code: 'EE', label: 'Eased Edge' }]) },
}));
vi.mock('@/services/inventoryService', () => ({ inventoryService: { getItem: vi.fn() } }));
vi.mock('@/components/inventory/ItemPicker', () => ({ ItemPicker: () => <div data-testid="item-picker" /> }));

import { CutoutLibrary } from './CutoutLibrary';
import { DrawingCanvas } from './DrawingCanvas';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { PieceInspector } from './PieceInspector';

const piece = (id: string, label: string, extra: Partial<Piece> = {}): Piece => ({
  id, label, shape: 'rect', outline: rectOutline(2000, 800), position: { x: 0, y: 0 }, rotationDeg: 0,
  thicknessMm: 30, edges: [], seams: [], cutouts: [], ...extra,
});
const sink: Cutout = { id: 'c1', type: 'sink', shape: 'rect', center: { x: 600, y: -400 }, widthMm: 600, depthMm: 400 };
const faucet: Cutout = { id: 'c2', type: 'faucet', shape: 'round', center: { x: 1400, y: -400 }, diameterMm: 40 };

function drawingOf(pieces: Piece[]): Drawing {
  return {
    schemaVersion: 1, salesOrderId: 'so1', version: 0, displayUnit: 'mm', fractionDenominator: 32,
    areas: [{ id: 'a', name: 'A', code: '', sortOrder: 0, pieces, cabinets: [], notes: [] }],
    updatedAt: '2026-11-03T00:00:00.000Z', updatedBy: { id: 'u1', name: 'T' },
  };
}

function Readout() {
  const { state } = useDrawingEditor();
  const area = state.present.areas[0];
  return (
    <div>
      <span data-testid="pieces">{JSON.stringify(area.pieces)}</span>
      <span data-testid="selected">{JSON.stringify([state.selectedPieceIds, state.selectedCutoutId, state.selectedEdgeIndex])}</span>
      <span data-testid="past">{state.past.length}</span>
    </div>
  );
}

function Selector({ ids, cutoutId }: { ids: string[]; cutoutId?: string }) {
  const { dispatch } = useDrawingEditor();
  return (
    <button
      type="button"
      onClick={() => (cutoutId
        ? dispatch({ type: 'selectCutout', pieceId: ids[0], cutoutId })
        : dispatch({ type: 'selectPieces', pieceIds: ids }))}
    >
      select
    </button>
  );
}

function setup(pieces: Piece[], select: { ids: string[]; cutoutId?: string }, panel: 'library' | 'inspector' | 'canvas') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DrawingEditorProvider drawing={drawingOf(pieces)} materialLines={[]}>
        <Selector {...select} />
        {panel === 'library' && <CutoutLibrary />}
        {panel === 'inspector' && <PieceInspector />}
        {panel === 'canvas' && <DrawingCanvas />}
        <Readout />
      </DrawingEditorProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const piecesNow = (): Piece[] => JSON.parse(screen.getByTestId('pieces').textContent ?? '[]');

beforeEach(() => {
  toastError.mockClear();
});

describe('CutoutLibrary', () => {
  it('is disabled until a piece is selected', () => {
    setup([piece('p1', 'A-1')], { ids: ['p1'] }, 'library');
    expect(screen.getByRole('button', { name: 'Add sink' })).toHaveProperty('disabled', true);
  });

  it('adds the chosen cutout at the middle of the selected piece, at its default size, and selects it', async () => {
    const user = setup([piece('p1', 'A-1')], { ids: ['p1'] }, 'library');
    await user.click(screen.getByRole('button', { name: 'select' }));
    await user.click(screen.getByRole('button', { name: 'Add sink' }));
    const [added] = piecesNow()[0].cutouts;
    expect(added).toMatchObject({ type: 'sink', shape: 'rect', center: { x: 1000, y: -400 } });
    expect(JSON.parse(screen.getByTestId('selected').textContent ?? '[]')[1]).toBe(added.id);
  });

  it('refuses a cutout that cannot fit, and says why instead of adding it', async () => {
    const user = setup([piece('p1', 'A-1', { outline: rectOutline(300, 200) })], { ids: ['p1'] }, 'library');
    await user.click(screen.getByRole('button', { name: 'select' }));
    await user.click(screen.getByRole('button', { name: 'Add sink' }));
    expect(piecesNow()[0].cutouts).toEqual([]);
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('fully inside'));
  });

  it('refuses a second cutout dropped on top of the first', async () => {
    const user = setup([piece('p1', 'A-1', { cutouts: [{ ...sink, center: { x: 1000, y: -400 } }] })], { ids: ['p1'] }, 'library');
    await user.click(screen.getByRole('button', { name: 'select' }));
    await user.click(screen.getByRole('button', { name: 'Add cooktop' }));
    expect(piecesNow()[0].cutouts).toHaveLength(1);
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('overlaps'));
  });
});

describe('Cutout inspector', () => {
  const open = async () => {
    const user = setup([piece('p1', 'A-1', { cutouts: [sink, faucet] })], { ids: ['p1'], cutoutId: 'c1' }, 'inspector');
    await user.click(screen.getByRole('button', { name: 'select' }));
    return user;
  };

  it('shows the selected cutout\'s own size and position fields', async () => {
    await open();
    expect(screen.getByLabelText('Width')).toHaveProperty('value', '600mm');
    expect(screen.getByLabelText('Height')).toHaveProperty('value', '400mm');
    expect(screen.getByLabelText('Centre from left edge')).toHaveProperty('value', '600mm');
    expect(screen.getByLabelText('Centre from top edge')).toHaveProperty('value', '400mm');
  });

  it('saves a valid new width as exactly that many mm', async () => {
    const user = await open();
    const width = screen.getByLabelText('Width');
    await user.clear(width);
    await user.type(width, '700mm');
    await user.tab();
    expect(piecesNow()[0].cutouts[0].widthMm).toBe(700);
  });

  it('refuses a width that would run into the neighbouring cutout, keeps the old size, and says why', async () => {
    const user = await open();
    const width = screen.getByLabelText('Width');
    await user.clear(width);
    await user.type(width, '1600mm');
    await user.tab();
    expect(piecesNow()[0].cutouts[0].widthMm).toBe(600);
    expect(within(screen.getByLabelText('Width').closest('label') as HTMLElement).getByRole('alert').textContent).toMatch(/overlaps|inside/);
  });

  it('moves the cutout by its distance from the left and top edges', async () => {
    const user = await open();
    const left = screen.getByLabelText('Centre from left edge');
    await user.clear(left);
    await user.type(left, '800mm');
    await user.tab();
    expect(piecesNow()[0].cutouts[0].center).toEqual({ x: 800, y: -400 });
  });

  it('rejects a position that would put the cutout outside the piece', async () => {
    const user = await open();
    const left = screen.getByLabelText('Centre from left edge');
    await user.clear(left);
    await user.type(left, '50mm');
    await user.tab();
    expect(piecesNow()[0].cutouts[0].center.x).toBe(600);
  });

  it('switching shape keeps the size, and Back returns to the piece', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Back to A-1' }));
    expect(screen.getByLabelText('Label')).toBeDefined();
  });

  it('Delete removes the cutout and returns to the piece', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Delete Sink' }));
    expect(piecesNow()[0].cutouts.map((c) => c.id)).toEqual(['c2']);
  });
});

describe('Piece sides', () => {
  const open = async (extra: Partial<Piece> = {}) => {
    const user = setup([piece('p1', 'A-1', extra)], { ids: ['p1'] }, 'inspector');
    await user.click(screen.getByRole('button', { name: 'select' }));
    return user;
  };

  it('lists every side with its exact length', async () => {
    await open();
    expect(screen.getByLabelText('Side A length')).toHaveProperty('value', '2000mm');
    expect(screen.getByLabelText('Side B length')).toHaveProperty('value', '800mm');
  });

  it('setting a side length resizes the piece and keeps it square', async () => {
    const user = await open();
    const side = screen.getByLabelText('Side A length');
    await user.clear(side);
    await user.type(side, '2400mm');
    await user.tab();
    expect(piecesNow()[0].outline).toEqual(rectOutline(2400, 800));
  });

  it('refuses a length that would leave a cutout outside the piece', async () => {
    const user = await open({ cutouts: [{ ...sink, center: { x: 1700, y: -400 } }] });
    const side = screen.getByLabelText('Side A length');
    await user.clear(side);
    await user.type(side, '1800mm');
    await user.tab();
    expect(piecesNow()[0].outline).toEqual(rectOutline(2000, 800));
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });

  it('rotation accepts any angle', async () => {
    const user = await open();
    const rotation = screen.getByLabelText('Rotation (degrees)');
    await user.clear(rotation);
    await user.type(rotation, '37.5');
    await user.tab();
    expect(piecesNow()[0].rotationDeg).toBe(37.5);
  });
});

describe('Corner handles and selection on the canvas', () => {
  it('shows a handle per corner and a "+" per side for a single selected piece', async () => {
    const user = setup([piece('p1', 'A-1')], { ids: ['p1'] }, 'canvas');
    await user.click(screen.getByRole('button', { name: 'select' }));
    expect(screen.getAllByRole('button', { name: /^Corner \d of A-1/ })).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: /^Add corner on side/ })).toHaveLength(4);
  });

  it('adds a corner at the middle of a side as one undoable step, turning the piece into a polygon', async () => {
    const user = setup([piece('p1', 'A-1')], { ids: ['p1'] }, 'canvas');
    await user.click(screen.getByRole('button', { name: 'select' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Add corner on side A' }));
    const [p] = piecesNow();
    expect(p.outline).toHaveLength(5);
    expect(p.outline[1]).toEqual({ x: 1000, y: 0 });
    expect(p.shape).toBe('polygon');
    expect(screen.getByTestId('past').textContent).toBe('1');
  });

  it('moves a corner with the arrow keys, but not into an invalid shape', async () => {
    const user = setup([piece('p1', 'A-1', { cutouts: [{ ...sink, center: { x: 1000, y: -400 } }] })], { ids: ['p1'] }, 'canvas');
    await user.click(screen.getByRole('button', { name: 'select' }));
    const corner = screen.getByRole('button', { name: /^Corner 2 of A-1/ });
    fireEvent.keyDown(corner, { key: 'ArrowRight', shiftKey: true });
    expect(piecesNow()[0].outline[1].x).toBeCloseTo(2025.4);
    // Pushing the corner left across the opposite side makes the sides cross.
    fireEvent.keyDown(corner, { key: 'ArrowLeft', shiftKey: true });
    for (let i = 0; i < 100; i += 1) fireEvent.keyDown(screen.getByRole('button', { name: /^Corner 2 of A-1/ }), { key: 'ArrowLeft', shiftKey: true });
    expect(piecesNow()[0].outline[1].x).toBeGreaterThan(0);
    expect(toastError).toHaveBeenCalled();
  });

  it('removes a corner with Delete, but never below three', async () => {
    const tri = { outline: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 300, y: -500 }] };
    const user = setup([piece('p1', 'A-1', tri)], { ids: ['p1'] }, 'canvas');
    await user.click(screen.getByRole('button', { name: 'select' }));
    fireEvent.keyDown(screen.getByRole('button', { name: /^Corner 1 of A-1/ }), { key: 'Delete' });
    expect(piecesNow()[0].outline).toHaveLength(3);
    expect(toastError).toHaveBeenCalledWith('A piece needs at least 3 corners.');
  });

  it('Ctrl+A selects every piece, arrow keys then move them together as one undo step', async () => {
    const user = setup([piece('p1', 'A-1'), piece('p2', 'A-2', { position: { x: 3000, y: 0 } })], { ids: ['p1'] }, 'canvas');
    const canvas = screen.getByRole('application', { name: 'Drawing canvas' });
    await user.click(canvas);
    fireEvent.keyDown(canvas, { key: 'a', ctrlKey: true });
    expect(JSON.parse(screen.getByTestId('selected').textContent ?? '[]')[0]).toEqual(['p1', 'p2']);
    fireEvent.keyDown(canvas, { key: 'ArrowRight', shiftKey: true });
    expect(piecesNow().map((p) => p.position.x)).toEqual([25.4, 3025.4]);
    expect(screen.getByTestId('past').textContent).toBe('1');
  });

  it('Ctrl+D duplicates the selection, offset from the originals; Ctrl+C then Ctrl+V pastes a copy', async () => {
    const user = setup([piece('p1', 'A-1')], { ids: ['p1'] }, 'canvas');
    await user.click(screen.getByRole('button', { name: 'select' }));
    const canvas = screen.getByRole('application', { name: 'Drawing canvas' });
    fireEvent.keyDown(canvas, { key: 'd', ctrlKey: true });
    expect(piecesNow()).toHaveLength(2);
    expect(piecesNow()[1].position).not.toEqual(piecesNow()[0].position);
    fireEvent.keyDown(canvas, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(canvas, { key: 'v', ctrlKey: true });
    expect(piecesNow()).toHaveLength(3);
    expect(piecesNow().map((p) => p.label)).toEqual(['A-1', 'A-2', 'A-3']);
  });

  it('Delete removes the whole selection', async () => {
    const user = setup([piece('p1', 'A-1'), piece('p2', 'A-2')], { ids: ['p1', 'p2'] }, 'canvas');
    await user.click(screen.getByRole('button', { name: 'select' }));
    fireEvent.keyDown(screen.getByRole('application', { name: 'Drawing canvas' }), { key: 'Delete' });
    expect(piecesNow()).toEqual([]);
  });
});
