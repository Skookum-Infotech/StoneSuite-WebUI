// The top bar's Sketch / Cutout / Material tabs, the Cutout side panel and the
// Cutout dialog, end to end against the real reducer.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing, Piece } from '@/types/drawing';
import { MM_PER_INCH } from '@/lib/drawing/constants';
import { toast } from 'sonner';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('@/services/drawingService', () => ({
  drawingService: {
    listVersions: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    getEdgeCodes: vi.fn().mockResolvedValue([{ code: 'EE', label: 'Eased Edge' }]),
    getCutoutTypes: vi.fn().mockResolvedValue([
      { code: 'sink', label: 'Sink' },
      { code: 'cooktop', label: 'Cooktop' },
      { code: 'faucet', label: 'Faucet' },
      { code: 'fireplace', label: 'Fireplace' },
      { code: 'bathtub', label: 'Bathtub' },
      { code: 'other', label: 'Other' },
    ]),
  },
}));

import { CutoutPlacementLayer } from './CutoutPlacementLayer';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { DrawingToolbar } from './DrawingToolbar';
import { WorkspacePanel } from './WorkspacePanel';

const BIG_PIECE_MM = { width: 3000, depth: 1000 };

function makePiece(width: number, depth: number): Piece {
  return {
    id: 'p1',
    label: 'A-1',
    shape: 'rect',
    outline: [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: -depth }, { x: 0, y: -depth }],
    position: { x: 0, y: 0 },
    rotationDeg: 0,
    thicknessMm: 30,
    edges: [],
    seams: [],
    cutouts: [],
  };
}

function drawingWith(pieces: Piece[]): Drawing {
  return {
    schemaVersion: 1,
    salesOrderId: 'so1',
    version: 0,
    displayUnit: 'in',
    fractionDenominator: 32,
    areas: [{ id: 'area-1', name: 'Area 1', code: '', sortOrder: 0, pieces, cabinets: [], notes: [] }],
    updatedAt: '2026-11-16T00:00:00.000Z',
    updatedBy: { id: 'u1', name: 'Test User' },
  };
}

function SelectPiece() {
  const { dispatch } = useDrawingEditor();
  return <button type="button" onClick={() => dispatch({ type: 'selectPiece', pieceId: 'p1' })}>select piece</button>;
}

function Readout() {
  const { state } = useDrawingEditor();
  return <span data-testid="cutouts">{JSON.stringify(state.present.areas[0].pieces[0]?.cutouts ?? [])}</span>;
}

beforeEach(() => {
  // The board is 800 x 600, so 1px is 1mm and the piece origin is at (400, 300).
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => undefined,
  } as DOMRect);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(toast.error).mockClear();
});

/** Clicks the board where the piece's point (x, y) in mm is — where the target cursor drops the cutout. */
function placeCutout(x = 1500, y = -500) {
  fireEvent.click(screen.getByTestId('cutout-placement'), { clientX: 400 + x, clientY: 300 - y });
}

const cutouts = () => JSON.parse(screen.getByTestId('cutouts').textContent ?? '[]');

function renderEditor(pieces: Piece[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DrawingEditorProvider drawing={drawingWith(pieces)} materialLines={[]}>
        <div data-drawing-editor><DrawingToolbar saveStatus="idle" onSave={() => {}} orderNumber="1001" onExit={() => {}} /></div>
        <WorkspacePanel />
        <svg><CutoutPlacementLayer /></svg>
        <SelectPiece />
        <Readout />
      </DrawingEditorProvider>
    </QueryClientProvider>,
  );
}

async function openDialog() {
  await userEvent.click(screen.getByRole('button', { name: 'select piece' }));
  await userEvent.click(screen.getByRole('tab', { name: 'Cutout' }));
  await userEvent.click(screen.getByRole('button', { name: 'Only Cutout' }));
  return screen.findByRole('dialog');
}

describe('top bar workspace tabs', () => {
  it('opens on Sketch with no side panel', () => {
    renderEditor();
    expect(screen.getByRole('tab', { name: 'Sketch' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('Cutout docks the Cutouts panel and Sketch takes it away again', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('tab', { name: 'Cutout' }));
    const panel = screen.getByRole('complementary', { name: 'Cutouts' });
    expect(within(panel).getByRole('button', { name: 'Only Cutout' })).toBeDefined();
    expect(within(panel).getByRole('button', { name: 'Inventory' })).toBeDisabled();
    expect(within(panel).getByRole('button', { name: 'Custom Item' })).toBeDisabled();

    await userEvent.click(screen.getByRole('tab', { name: 'Sketch' }));
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('the panel\'s chevron folds it away and returns to Sketch', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('tab', { name: 'Cutout' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close Cutouts panel' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Sketch' })).toHaveAttribute('aria-selected', 'true');
  });

  it('Material opens its own panel', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('tab', { name: 'Material' }));
    expect(screen.getByRole('complementary', { name: 'Material' })).toBeDefined();
  });

  it('no longer has the zoom and fit buttons on the bar', () => {
    renderEditor();
    for (const name of ['Zoom in', 'Zoom out', 'Fit area']) expect(screen.queryByRole('button', { name })).toBeNull();
  });
});

function ToolProbe() {
  const { tool, setTool } = useDrawingEditor();
  return (
    <>
      <span data-testid="tool">{tool}</span>
      <button type="button" onClick={() => setTool('draw')}>arm draw</button>
    </>
  );
}

describe('tools and tabs', () => {
  const renderWithProbe = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <DrawingEditorProvider drawing={drawingWith([])} materialLines={[]}>
          <div data-drawing-editor><DrawingToolbar saveStatus="idle" onSave={() => {}} orderNumber="1001" onExit={() => {}} /></div>
          <WorkspacePanel />
          <ToolProbe />
        </DrawingEditorProvider>
      </QueryClientProvider>,
    );
  };

  it('opening the Cutout tab puts a drawing tool away', async () => {
    renderWithProbe();
    await userEvent.click(screen.getByRole('button', { name: 'arm draw' }));
    expect(screen.getByTestId('tool').textContent).toBe('draw');
    await userEvent.click(screen.getByRole('tab', { name: 'Cutout' }));
    expect(screen.getByTestId('tool').textContent).toBe('select');
  });

  it('picking a drawing tool from the Cutout tab goes back to Sketch', async () => {
    renderWithProbe();
    await userEvent.click(screen.getByRole('tab', { name: 'Cutout' }));
    await userEvent.click(screen.getByRole('button', { name: 'arm draw' }));
    expect(screen.getByRole('tab', { name: 'Sketch' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tool').textContent).toBe('draw');
  });
});

describe('Cutout panel', () => {
  it('asks for a piece first: Only Cutout stays off until one is selected', async () => {
    renderEditor([makePiece(BIG_PIECE_MM.width, BIG_PIECE_MM.depth)]);
    await userEvent.click(screen.getByRole('tab', { name: 'Cutout' }));
    expect(screen.getByRole('button', { name: 'Only Cutout' })).toBeDisabled();
    expect(screen.getByText('Select a piece to add cutouts to it.')).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: 'select piece' }));
    expect(screen.getByRole('button', { name: 'Only Cutout' })).toBeEnabled();
    expect(screen.getByText('No cutouts in this part yet.')).toBeDefined();
  });
});

describe('Cutout dialog', () => {
  it('lists the types from master data, starting on the first with its name filled in', async () => {
    renderEditor([makePiece(BIG_PIECE_MM.width, BIG_PIECE_MM.depth)]);
    const dialog = await openDialog();
    expect(within(dialog).getByLabelText('Cutout name')).toHaveValue('Cutout - Sink');

    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Cutout type' }));
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toEqual(['Sink', 'Cooktop', 'Faucet', 'Fireplace', 'Bathtub', 'Other']);
  });

  it('switching type renames the cutout and shows faucet holes only for a sink', async () => {
    renderEditor([makePiece(BIG_PIECE_MM.width, BIG_PIECE_MM.depth)]);
    const dialog = await openDialog();
    expect(within(dialog).getByLabelText('Faucet hole count')).toBeDefined();

    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Cutout type' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Fireplace' }));
    expect(within(dialog).getByLabelText('Cutout name')).toHaveValue('Cutout - Fireplace');
    expect(within(dialog).queryByLabelText('Faucet hole count')).toBeNull();
    expect(within(dialog).getByLabelText('Length')).toHaveValue('36"');
  });

  it('keeps a name the user typed when the type changes', async () => {
    renderEditor([makePiece(BIG_PIECE_MM.width, BIG_PIECE_MM.depth)]);
    const dialog = await openDialog();
    const name = within(dialog).getByLabelText('Cutout name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Kitchen sink');
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Cutout type' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Cooktop' }));
    expect(name).toHaveValue('Kitchen sink');
  });

  it('Save closes the dialog and turns the cursor into a target; the cutout is added where the board is clicked', async () => {
    renderEditor([makePiece(BIG_PIECE_MM.width, BIG_PIECE_MM.depth)]);
    const dialog = await openDialog();
    const length = within(dialog).getByLabelText('Length');
    await userEvent.clear(length);
    await userEvent.type(length, '23');
    const height = within(dialog).getByLabelText('Height');
    await userEvent.clear(height);
    await userEvent.type(height, '14');
    await userEvent.type(within(dialog).getByLabelText('Faucet hole count'), '1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(cutouts()).toHaveLength(0); // not added until it is placed
    expect(screen.getByText('Click on the piece to place the cutout.')).toBeDefined();

    placeCutout(1200, -300);
    const [cutout] = cutouts();
    expect(cutouts()).toHaveLength(1);
    // Snapped to a quarter inch (6.35mm), so within half of that of the click.
    expect(Math.abs(cutout.center.x - 1200)).toBeLessThanOrEqual(3.2);
    expect(Math.abs(cutout.center.y + 300)).toBeLessThanOrEqual(3.2);
    expect(screen.queryByText('Click on the piece to place the cutout.')).toBeNull();
    expect(cutout).toMatchObject({ type: 'sink', shape: 'rect', label: 'Cutout - Sink', faucetHoleCount: 1 });
    expect(cutout.widthMm).toBeCloseTo(23 * MM_PER_INCH, 5);
    expect(cutout.depthMm).toBeCloseTo(14 * MM_PER_INCH, 5);
    expect(screen.getByRole('button', { name: 'Edit Cutout - Sink' })).toBeDefined();
  });

  it('saves the distance lines as chosen', async () => {
    renderEditor([makePiece(BIG_PIECE_MM.width, BIG_PIECE_MM.depth)]);
    const dialog = await openDialog();
    const top = within(dialog).getByRole('radiogroup', { name: 'Top distance line' });
    await userEvent.click(within(top).getByRole('radio', { name: 'Border' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    placeCutout();
    expect(cutouts()[0].distanceLines).toEqual({ top: 'border', right: 'hidden', bottom: 'center', left: 'center' });
  });

  it('refuses a click that puts the cutout where it does not fit the piece, with the reason, and keeps waiting', async () => {
    renderEditor([makePiece(300, 300)]);
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    placeCutout(150, -150);
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/inside the piece/));
    expect(cutouts()).toHaveLength(0);
    expect(screen.getByText('Click on the piece to place the cutout.')).toBeDefined();
  });

  it('says what is wrong with a length that cannot be read', async () => {
    renderEditor([makePiece(BIG_PIECE_MM.width, BIG_PIECE_MM.depth)]);
    const dialog = await openDialog();
    const length = within(dialog).getByLabelText('Length');
    await userEvent.clear(length);
    await userEvent.type(length, 'banana');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('alert').textContent).toMatch(/isn't a length/);
    expect(cutouts()).toHaveLength(0);
  });

  it('Back closes without adding anything', async () => {
    renderEditor([makePiece(BIG_PIECE_MM.width, BIG_PIECE_MM.depth)]);
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(cutouts()).toHaveLength(0);
  });
});
