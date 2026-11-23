// Cutouts are edited in the Cutout tab only: there a click on one (on the board
// or in the panel) reopens the Cutout dialog filled with it; in Sketch it is
// just drawn and cannot be picked, moved or edited.

import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cutout, Drawing, Piece } from '@/types/drawing';
import { MM_PER_INCH } from '@/lib/drawing/constants';

vi.mock('@/services/drawingService', () => ({
  drawingService: {
    listVersions: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    getEdgeCodes: vi.fn().mockResolvedValue([{ code: 'EE', label: 'Eased Edge' }]),
    getCutoutTypes: vi.fn().mockResolvedValue([
      { code: 'sink', label: 'Sink' },
      { code: 'cooktop', label: 'Cooktop' },
      { code: 'other', label: 'Other' },
    ]),
  },
}));

import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { PieceShape } from './PieceShape';
import { WorkspacePanel } from './WorkspacePanel';
import { WorkspaceTabs } from './WorkspaceTabs';

const SINK: Cutout = {
  id: 'c1', type: 'sink', shape: 'rect', center: { x: 1500, y: -500 }, rotationDeg: 0,
  widthMm: 23 * MM_PER_INCH, depthMm: 14 * MM_PER_INCH, label: 'Kitchen sink', edgeCode: 'EE', faucetHoleCount: 3,
  distanceLines: { top: 'border', right: 'hidden', bottom: 'center', left: 'center' },
};

const PIECE: Piece = {
  id: 'p1', label: 'A-1', shape: 'rect',
  outline: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: -1000 }, { x: 0, y: -1000 }],
  position: { x: 0, y: 0 }, rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [SINK],
};

const DRAWING: Drawing = {
  schemaVersion: 1, salesOrderId: 'so1', version: 0, displayUnit: 'in', fractionDenominator: 32,
  areas: [{ id: 'a1', name: 'Area 1', code: '', sortOrder: 0, pieces: [PIECE], cabinets: [], notes: [] }],
  updatedAt: '2026-11-16T00:00:00.000Z', updatedBy: { id: 'u1', name: 'Test' },
};

/** The board, drawn from live state so edits show up. */
function Board() {
  const { state } = useDrawingEditor();
  const piece = state.present.areas[0].pieces[0];
  return <svg><PieceShape piece={piece} selected={state.selectedPieceIds.includes(piece.id)} /></svg>;
}

function Readout() {
  const { state } = useDrawingEditor();
  return <span data-testid="cutouts">{JSON.stringify(state.present.areas[0].pieces[0].cutouts)}</span>;
}

const cutouts = (): Cutout[] => JSON.parse(screen.getByTestId('cutouts').textContent ?? '[]');

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DrawingEditorProvider drawing={DRAWING} materialLines={[]}>
        <WorkspaceTabs />
        <Board />
        <WorkspacePanel />
        <Readout />
      </DrawingEditorProvider>
    </QueryClientProvider>,
  );
}

const clickCutout = () => {
  const cutout = screen.getByRole('button', { name: /^Kitchen sink/ });
  fireEvent.pointerDown(cutout, { pointerId: 1, clientX: 0, clientY: 0 });
  fireEvent.pointerUp(cutout, { pointerId: 1, clientX: 0, clientY: 0 });
};

/** Clicks the cutout and waits for the dialog's form (the types load first). */
async function openEditor() {
  clickCutout();
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByLabelText('Cutout name');
  return dialog;
}

describe('in Sketch', () => {
  it('a cutout is drawn but cannot be picked: it is not a control, and clicks pass through to the piece', () => {
    renderEditor();
    expect(screen.queryByRole('button', { name: /^Kitchen sink/ })).toBeNull();
    expect(screen.getByText('Kitchen sink')).toBeDefined(); // still labelled on the board
    const outline = document.querySelector('polygon[pointer-events="none"]');
    expect(outline).not.toBeNull();
  });
});

describe('in the Cutout tab', () => {
  it('clicking a cutout on the board opens the Cutout dialog filled with it', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('tab', { name: 'Cutout' }));
    const dialog = await openEditor();
    expect(within(dialog).getByLabelText('Cutout name')).toHaveValue('Kitchen sink');
    expect(within(dialog).getByLabelText('Length')).toHaveValue('23"');
    expect(within(dialog).getByLabelText('Height')).toHaveValue('14"');
    expect(within(dialog).getByLabelText('Faucet hole count')).toHaveValue('3');
    expect(within(dialog).getByRole('combobox', { name: 'Cutout type' }).textContent).toContain('Sink');
    const top = within(dialog).getByRole('radiogroup', { name: 'Top distance line' });
    expect(within(top).getByRole('radio', { name: 'Border' })).toHaveAttribute('aria-checked', 'true');
  });

  it('Save updates that cutout in place, keeping its position', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('tab', { name: 'Cutout' }));
    const dialog = await openEditor();
    const length = within(dialog).getByLabelText('Length');
    await userEvent.clear(length);
    await userEvent.type(length, '30');
    await userEvent.click(within(dialog).getByLabelText('Hide name'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    const [edited] = cutouts();
    expect(cutouts()).toHaveLength(1);
    expect(edited.id).toBe('c1');
    expect(edited.center).toEqual(SINK.center);
    expect(edited.widthMm).toBeCloseTo(30 * MM_PER_INCH, 5);
    expect(edited.hideName).toBe(true);
    expect(edited.edgeCode).toBe('EE');
  });

  it('refuses an edit that no longer fits the piece and leaves the cutout as it was', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('tab', { name: 'Cutout' }));
    const dialog = await openEditor();
    const length = within(dialog).getByLabelText('Length');
    await userEvent.clear(length);
    await userEvent.type(length, '200');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('alert').textContent).toMatch(/inside the piece/);
    expect(cutouts()[0].widthMm).toBeCloseTo(23 * MM_PER_INCH, 5);
  });

  it('Delete in the dialog removes the cutout', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('tab', { name: 'Cutout' }));
    const dialog = await openEditor();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(cutouts()).toEqual([]);
  });

  it('a cutout in the panel list opens the same dialog', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('tab', { name: 'Cutout' }));
    clickCutout(); // selects the piece, so the panel lists its cutouts
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Back' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit Kitchen sink' }));
    expect(within(await screen.findByRole('dialog')).getByLabelText('Cutout name')).toHaveValue('Kitchen sink');
  });

  it('switching back to Sketch closes the editor and locks the cutout again', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('tab', { name: 'Cutout' }));
    clickCutout();
    await screen.findByRole('dialog');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Back' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Sketch' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Kitchen sink/ })).toBeNull();
  });
});
