// @vitest-environment jsdom
// "Slabs required" in the status bar and the Material tab, and the Material tab's
// "Nest all" button.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Drawing } from '@/types/drawing';
import type { DrawingSlabItem, DrawingSlabUnit } from '@/types/drawingSlab';
import { rectOutline } from '@/lib/drawing/geometry';
import { UNIT_STATUS_RESERVED } from '@/types/inventory';

vi.mock('@/services/drawingSlabService', () => ({
  drawingSlabService: { listOptions: vi.fn(), hold: vi.fn(), release: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { drawingSlabService } from '@/services/drawingSlabService';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { DrawingStatusBar } from './DrawingStatusBar';
import { MaterialPanel } from './MaterialPanel';

function slab(id: string): DrawingSlabUnit {
  return {
    id, serial: id.toUpperCase(), kind: 'slab', status: UNIT_STATUS_RESERVED, reservedSalesOrderId: 'so1',
    lengthMm: 1000, widthMm: 500, thicknessMm: 30, area: 0.5, areaUnitId: 1, areaUnitCode: 'SQM', inventoryItemName: 'Calacatta',
  } as unknown as DrawingSlabUnit;
}

function options(...ids: string[]): DrawingSlabItem[] {
  return [{ itemId: 'i1', itemName: 'Calacatta', itemSku: 'CAL', units: ids.map(slab) }];
}

function drawing(): Drawing {
  const piece = (id: string, label: string) => ({
    id, label, shape: 'rect' as const, outline: rectOutline(600, 500), position: { x: 0, y: 0 },
    rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
  });
  return {
    schemaVersion: 1, salesOrderId: 'so1', version: 0, displayUnit: 'mm', fractionDenominator: 32,
    areas: [{ id: 'a', name: 'Kitchen', code: '', sortOrder: 0, cabinets: [], notes: [], pieces: [piece('p1', 'A-1'), piece('p2', 'A-2')] }],
    updatedAt: '', updatedBy: { id: 'u', name: 'U' },
  };
}

function Readout() {
  const { state } = useDrawingEditor();
  const slabs = state.present.areas[0].pieces.map((p) => p.slab?.slabId ?? '-');
  return <span data-testid="slabs">{slabs.join(',')}</span>;
}

function open(units: DrawingSlabItem[]) {
  vi.mocked(drawingSlabService.listOptions).mockResolvedValue(units);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DrawingEditorProvider drawing={drawing()} materialLines={[]}>
        <DrawingStatusBar />
        <MaterialPanel />
        <Readout />
      </DrawingEditorProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => vi.clearAllMocks());

/** The slabs load a moment after the panel opens; Nest all is off until they have. */
const waitForNestAll = () => waitFor(() => {
  expect((screen.getByRole('button', { name: 'Nest all' }) as HTMLButtonElement).disabled).toBe(false);
});

describe('Slabs required', () => {
  it('uses the size of the biggest slab the order holds', async () => {
    open(options('s1'));
    // Two 600 x 500 pieces cannot share a 1000 x 500 slab.
    await waitFor(() => expect(screen.getAllByRole('status', { name: 'Slabs required: 2' }).length).toBeGreaterThan(0));
    const [bar] = screen.getAllByRole('status', { name: 'Slabs required: 2' });
    expect(bar.getAttribute('title')).toContain('the biggest one on this order');
  });

  it('assumes a jumbo slab while the order holds none, and says so', async () => {
    open([]);
    // The same two pieces share one jumbo slab.
    await waitFor(() => expect(screen.getAllByRole('status', { name: 'Slabs required: 1' }).length).toBeGreaterThan(0));
    const [bar] = screen.getAllByRole('status', { name: 'Slabs required: 1' });
    expect(bar.getAttribute('title')).toContain('Add a slab from Inventory');
  });

  it('is shown on the status bar and on the Material tab', async () => {
    open(options('s1'));
    await waitFor(() => expect(screen.getAllByRole('status', { name: /Slabs required/ })).toHaveLength(2));
  });
});

describe('Nest all', () => {
  it('lays every piece on the slabs the order holds and reports it', async () => {
    const user = open(options('s1', 's2'));
    await waitForNestAll();
    await user.click(screen.getByRole('button', { name: 'Nest all' }));
    await waitFor(() => expect(screen.getByTestId('slabs').textContent).toBe('s1,s2'));
    expect(toast.success).toHaveBeenCalledWith('Laid 2 pieces on your slabs.');
    // Nothing left to place.
    expect((screen.getByRole('button', { name: 'Nest all' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('leaves out a piece that fits on none of the slabs and says so', async () => {
    const user = open(options('s1'));
    await waitForNestAll();
    await user.click(screen.getByRole('button', { name: 'Nest all' }));
    await waitFor(() => expect(screen.getByTestId('slabs').textContent).toBe('s1,-'));
    expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/Laid 1 of 2 pieces\. 1 would not fit/));
  });

  it('cannot run while the order holds no slab', async () => {
    open([]);
    await waitFor(() => expect(screen.getByText(/No slabs yet/)).toBeTruthy());
    expect((screen.getByRole('button', { name: 'Nest all' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
