// Picking a picture for a cutout in the Cutout dialog, and seeing it on the board.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cutout, Drawing, Piece } from '@/types/drawing';

vi.mock('@/services/drawingService', () => ({
  drawingService: {
    listVersions: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    getEdgeCodes: vi.fn().mockResolvedValue([]),
    getCutoutTypes: vi.fn().mockResolvedValue([
      { code: 'sink', label: 'Sink' },
      { code: 'cooktop', label: 'Cooktop' },
      { code: 'faucet', label: 'Faucet' },
    ]),
  },
}));

import { CutoutPlacementLayer } from './CutoutPlacementLayer';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { PieceShape } from './PieceShape';
import { WorkspacePanel } from './WorkspacePanel';
import { WorkspaceTabs } from './WorkspaceTabs';

const PIECE: Piece = {
  id: 'p1', label: 'A-1', shape: 'rect',
  outline: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: -1000 }, { x: 0, y: -1000 }],
  position: { x: 0, y: 0 }, rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
};

function drawingWith(cutouts: Cutout[]): Drawing {
  return {
    schemaVersion: 1, salesOrderId: 'so1', version: 0, displayUnit: 'in', fractionDenominator: 32,
    areas: [{ id: 'a1', name: 'Area 1', code: '', sortOrder: 0, pieces: [{ ...PIECE, cutouts }], cabinets: [], notes: [] }],
    updatedAt: '2026-11-16T00:00:00.000Z', updatedBy: { id: 'u1', name: 'Test' },
  };
}

function Board() {
  const { state, dispatch } = useDrawingEditor();
  const piece = state.present.areas[0].pieces[0];
  return (
    <>
      <svg><PieceShape piece={piece} selected={state.selectedPieceIds.includes(piece.id)} /></svg>
      <button type="button" onClick={() => dispatch({ type: 'selectPiece', pieceId: 'p1' })}>select piece</button>
    </>
  );
}

function Readout() {
  const { state } = useDrawingEditor();
  return <span data-testid="cutouts">{JSON.stringify(state.present.areas[0].pieces[0].cutouts)}</span>;
}

beforeEach(() => {
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => undefined,
  } as DOMRect);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Saves the dialog, then clicks the board where the target cursor drops the cutout. */
async function saveAndPlace(dialog: HTMLElement) {
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  fireEvent.click(screen.getByTestId('cutout-placement'), { clientX: 400 + 1500, clientY: 300 + 500 });
}

const cutouts = (): Cutout[] => JSON.parse(screen.getByTestId('cutouts').textContent ?? '[]');

function renderEditor(existing: Cutout[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DrawingEditorProvider drawing={drawingWith(existing)} materialLines={[]}>
        <WorkspaceTabs />
        <Board />
        <WorkspacePanel />
        <svg><CutoutPlacementLayer /></svg>
        <Readout />
      </DrawingEditorProvider>
    </QueryClientProvider>,
  );
}

async function openAddDialog() {
  renderEditor();
  await userEvent.click(screen.getByRole('button', { name: 'select piece' }));
  await userEvent.click(screen.getByRole('tab', { name: 'Cutout' }));
  await userEvent.click(screen.getByRole('button', { name: 'Only Cutout' }));
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByLabelText('Cutout name');
  return dialog;
}

describe('the Cutout dialog’s shapes', () => {
  it('starts on No Picture and lists No Picture plus all twenty sink shapes under Change', async () => {
    const dialog = await openAddDialog();
    expect(within(dialog).getByText('No Picture')).toBeDefined();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    const shapes = within(dialog).getByRole('list', { name: 'Shapes' });
    const names = within(shapes).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toHaveLength(21);
    expect(names.slice(0, 3)).toEqual(['No Picture', 'Farmhouse', 'Double bowl 60/40']);
  });

  it('picking a shape shows it in the Shape box and gives the cutout that shape’s usual size', async () => {
    const dialog = await openAddDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Farmhouse' }));
    expect(within(dialog).getByRole('img', { name: 'Farmhouse' })).toBeDefined();
    expect(within(dialog).getByLabelText('Length')).toHaveValue('36"');
    expect(within(dialog).getByLabelText('Height')).toHaveValue('18"');
  });

  it('keeps a size the user typed when a shape is picked', async () => {
    const dialog = await openAddDialog();
    const length = within(dialog).getByLabelText('Length');
    await userEvent.clear(length);
    await userEvent.type(length, '40');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Triple bowl' }));
    expect(within(dialog).getByLabelText('Length')).toHaveValue('40');
  });

  it('Save keeps the picked shape on the cutout', async () => {
    const dialog = await openAddDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vanity' }));
    await saveAndPlace(dialog);
    expect(cutouts()[0].shapeCode).toBe('sink.vanity');
  });

  it('No Picture takes the shape off again', async () => {
    const dialog = await openAddDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vanity' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'No Picture' }));
    await saveAndPlace(dialog);
    expect(cutouts()[0]).not.toHaveProperty('shapeCode');
  });

  it('moving to another type drops the sink shape, and a type with no shapes has Change switched off', async () => {
    const dialog = await openAddDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Farmhouse' }));
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Cutout type' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Faucet' }));
    expect(within(dialog).getByRole('button', { name: 'Change' })).toBeDisabled();
    expect(within(dialog).getByText('No Picture')).toBeDefined();
    await saveAndPlace(dialog);
    expect(cutouts()[0]).not.toHaveProperty('shapeCode');
  });
});

describe('a cutout with a picture, on the board', () => {
  const SINK: Cutout = {
    id: 'c1', type: 'sink', shape: 'rect', center: { x: 1500, y: -500 }, rotationDeg: 0, widthMm: 900, depthMm: 450, label: 'Kitchen sink',
  };

  it('is drawn with its picture, in Sketch as well as the Cutout tab', async () => {
    renderEditor([{ ...SINK, shapeCode: 'sink.farmhouse' }]);
    expect(screen.getByTestId('cutout-picture')).toBeDefined();
    await userEvent.click(screen.getByRole('tab', { name: 'Cutout' }));
    expect(screen.getByTestId('cutout-picture')).toBeDefined();
  });

  it('is just the plain rectangle with no picture when it has none', () => {
    renderEditor([SINK]);
    expect(screen.queryByTestId('cutout-picture')).toBeNull();
  });

  it('reopens for editing with its shape selected', async () => {
    renderEditor([{ ...SINK, shapeCode: 'sink.farmhouse' }]);
    await userEvent.click(screen.getByRole('button', { name: 'select piece' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Cutout' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit Kitchen sink' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByLabelText('Cutout name');
    expect(within(dialog).getByRole('img', { name: 'Farmhouse' })).toBeDefined();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    expect(within(dialog).getByRole('button', { name: 'Farmhouse' })).toHaveAttribute('aria-pressed', 'true');
  });
});
