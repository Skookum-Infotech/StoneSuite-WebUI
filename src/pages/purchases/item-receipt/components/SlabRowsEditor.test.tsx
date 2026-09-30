import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/inventoryBinService', () => ({
  inventoryBinService: {
    getTree: vi.fn().mockResolvedValue([
      { id: 'bin-1', name: 'Rack A', code: 'RA', path: 'RA', depth: 1, unitCount: 0, overCapacity: false, children: [] },
    ]),
  },
}));

vi.mock('@/services/inventoryService', () => ({
  inventoryService: { getItem: vi.fn().mockResolvedValue({ id: 'item-1', thicknessMm: 30 }) },
}));

import { SlabRowsEditor } from './SlabRowsEditor';
import { inventoryBinService } from '@/services/inventoryBinService';
import { newDraftSlab, type ItemReceiptDraftSlab } from '@/lib/itemReceiptSlabs';
import type { ItemReceiptDraftLine } from '@/lib/itemReceiptForm';

function line(slabs: ItemReceiptDraftSlab[]): ItemReceiptDraftLine {
  return {
    purchaseOrderItemId: 'poi-1', lineNumber: 1, itemName: 'Absolute Black', sku: 'AB-30',
    description: '', unitCode: 'SQFT', qtyOrdered: 500, qtyAlreadyReceived: 0,
    qtyReceived: '', qtyRejected: '0', lineNotes: '', tracking: 'serialized', slabs,
  };
}

// 3048 x 1524 mm is exactly 10 ft x 5 ft = 50 sq ft.
const fullSlab = (over: Partial<ItemReceiptDraftSlab> = {}) =>
  newDraftSlab({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30', ...over });

// The editor is controlled, so the tests drive it through a parent that owns
// the slabs, the way ReceiptLinesTable does.
function Harness({ initial, serials = [], problems = [], warehouseId = 'wh-1', onSlabs }: {
  initial: ItemReceiptDraftSlab[];
  serials?: string[];
  problems?: string[];
  warehouseId?: string;
  onSlabs?: (s: ItemReceiptDraftSlab[]) => void;
}) {
  const [slabs, setSlabs] = useState(initial);
  return (
    <SlabRowsEditor
      line={line(slabs)}
      onChange={(next) => { setSlabs(next); onSlabs?.(next); }}
      serials={serials}
      warehouseId={warehouseId}
      problems={problems}
    />
  );
}

function renderEditor(props: Parameters<typeof Harness>[0]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><Harness {...props} /></QueryClientProvider>);
}

describe('SlabRowsEditor', () => {
  it('says the line is skipped until a slab is added', () => {
    renderEditor({ initial: [] });
    expect(screen.getByText(/None added — this line is skipped/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('adds a blank slab row', async () => {
    const user = userEvent.setup();
    renderEditor({ initial: [] });

    await user.click(screen.getByRole('button', { name: 'Add a slab for Absolute Black' }));

    expect(screen.getByText('1 slab')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Length (mm) of slab 1' })).toHaveValue(null);
  });

  it('previews each slab serial, and says it is assigned on save while unknown', () => {
    renderEditor({ initial: [fullSlab(), fullSlab()], serials: ['PORD-000012-004', ''] });

    expect(screen.getByTestId('slab-serial-1')).toHaveTextContent('PORD-000012-004');
    expect(screen.getByTestId('slab-serial-2')).toHaveTextContent('assigned on save');
  });

  it('computes the area as the dimensions are typed', async () => {
    const user = userEvent.setup();
    renderEditor({ initial: [newDraftSlab()] });
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('—')).toBeInTheDocument();

    await user.type(screen.getByRole('spinbutton', { name: 'Length (mm) of slab 1' }), '3048');
    await user.type(screen.getByRole('spinbutton', { name: 'Width (mm) of slab 1' }), '1524');

    expect(within(row).getByText('50.000')).toBeInTheDocument();
  });

  it('removes a slab', async () => {
    const user = userEvent.setup();
    const onSlabs = vi.fn();
    renderEditor({ initial: [fullSlab({ lot: 'first' }), fullSlab({ lot: 'second' })], onSlabs });

    await user.click(screen.getByRole('button', { name: 'Remove slab 1' }));

    const [remaining] = onSlabs.mock.calls[0][0] as ItemReceiptDraftSlab[];
    expect(onSlabs.mock.calls[0][0]).toHaveLength(1);
    expect(remaining.lot).toBe('second');
  });

  it('duplicates a slab right after itself, without its supplier code', async () => {
    const user = userEvent.setup();
    const onSlabs = vi.fn();
    renderEditor({
      initial: [fullSlab({ lot: 'L1', supplierCode: 'S-1' }), fullSlab({ lot: 'other' })],
      onSlabs,
    });

    await user.click(screen.getByRole('button', { name: 'Duplicate slab 1' }));

    const next = onSlabs.mock.calls[0][0] as ItemReceiptDraftSlab[];
    expect(next).toHaveLength(3);
    expect(next[1]).toMatchObject({ lengthMm: '3048', widthMm: '1524', lot: 'L1', supplierCode: '' });
    expect(next[1].key).not.toBe(next[0].key);
    expect(next[2].lot).toBe('other');
  });

  it('keeps Block ID, Lot, Grade and Supplier code behind a per-slab toggle', async () => {
    const user = userEvent.setup();
    const onSlabs = vi.fn();
    renderEditor({ initial: [fullSlab()], onSlabs });
    expect(screen.queryByRole('textbox', { name: 'Lot of slab 1' })).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Show more fields for slab 1' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);

    expect(screen.getByRole('button', { name: 'Hide more fields for slab 1' })).toHaveAttribute('aria-expanded', 'true');
    for (const label of ['Block ID', 'Lot', 'Grade', 'Supplier code']) {
      expect(screen.getByRole('textbox', { name: `${label} of slab 1` })).toBeInTheDocument();
    }
    await user.type(screen.getByRole('textbox', { name: 'Lot of slab 1' }), 'L9');
    expect((onSlabs.mock.calls.at(-1)?.[0] as ItemReceiptDraftSlab[])[0].lot).toBe('L9');
  });

  it('offers the receiving warehouse\'s bins and records the chosen one', async () => {
    const user = userEvent.setup();
    const onSlabs = vi.fn();
    renderEditor({ initial: [fullSlab()], onSlabs, warehouseId: 'wh-7' });

    const bin = screen.getByRole('combobox', { name: 'Bin for slab 1' });
    await user.selectOptions(bin, await screen.findByRole('option', { name: /Rack A/ }));

    expect(inventoryBinService.getTree).toHaveBeenCalledWith('wh-7');
    expect((onSlabs.mock.calls.at(-1)?.[0] as ItemReceiptDraftSlab[])[0].binId).toBe('bin-1');
  });

  it('does not ask for bins until a warehouse is chosen', () => {
    vi.mocked(inventoryBinService.getTree).mockClear();
    renderEditor({ initial: [fullSlab()], warehouseId: '' });
    expect(inventoryBinService.getTree).not.toHaveBeenCalled();
  });

  it('shows what is still wrong as an alert', () => {
    renderEditor({ initial: [newDraftSlab()], problems: ['Slab 1: length, width and thickness must all be greater than zero.'] });
    expect(screen.getByRole('alert')).toHaveTextContent('Slab 1: length, width and thickness must all be greater than zero.');
  });

  it('shows no alert when nothing is wrong', () => {
    renderEditor({ initial: [fullSlab()] });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ── expected-slab progress, packing-list paste and apply-to-all ─────────────

function lineWith(over: Partial<ItemReceiptDraftLine>): ItemReceiptDraftLine {
  return { ...line([]), inventoryItemId: 'item-1', ...over };
}

function renderLine(l: ItemReceiptDraftLine, onSlabs?: (s: ItemReceiptDraftSlab[]) => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper() {
    const [slabs, setSlabs] = useState(l.slabs);
    return (
      <SlabRowsEditor
        line={{ ...l, slabs }}
        onChange={(next) => { setSlabs(next); onSlabs?.(next); }}
        serials={[]}
        warehouseId="wh-1"
        problems={[]}
      />
    );
  }
  render(<QueryClientProvider client={queryClient}><Wrapper /></QueryClientProvider>);
}

describe('SlabRowsEditor — expected slabs', () => {
  it('shows "11 of about 12" with this receipt on top of earlier ones', () => {
    renderLine(lineWith({ expectedSlabs: 12, slabsReceived: 8, slabs: [fullSlab(), fullSlab(), fullSlab()] }));
    expect(screen.getByTestId('slab-progress')).toHaveTextContent('11 of about 12 slabs with this receipt (8 on earlier receipts)');
  });

  it('shows plain progress on a first receipt', () => {
    renderLine(lineWith({ expectedSlabs: 12, slabsReceived: 0, slabs: [fullSlab()] }));
    expect(screen.getByTestId('slab-progress')).toHaveTextContent('1 of about 12 slabs with this receipt');
    expect(screen.getByTestId('slab-progress')).not.toHaveTextContent('earlier');
  });

  it('flags more slabs than expected without blocking anything', () => {
    renderLine(lineWith({ expectedSlabs: 2, slabsReceived: 0, slabs: [fullSlab(), fullSlab(), fullSlab()] }));
    expect(screen.getByTestId('slab-progress')).toHaveTextContent('3 of about 2 slabs with this receipt — more than expected');
  });

  it('updates as slabs are added', async () => {
    const user = userEvent.setup();
    renderLine(lineWith({ expectedSlabs: 12, slabsReceived: 8, slabs: [] }));
    expect(screen.getByTestId('slab-progress')).toHaveTextContent('8 of about 12 slabs with this receipt');

    await user.click(screen.getByRole('button', { name: 'Add a slab for Absolute Black' }));

    expect(screen.getByTestId('slab-progress')).toHaveTextContent('9 of about 12 slabs');
  });

  it('says how many arrived earlier when no count was expected', () => {
    renderLine(lineWith({ expectedSlabs: null, slabsReceived: 8, slabs: [fullSlab()] }));
    expect(screen.getByTestId('slab-progress')).toHaveTextContent('8 slabs already received on earlier receipts');
  });

  it('shows nothing extra when there is neither an expectation nor an earlier receipt', () => {
    renderLine(lineWith({ expectedSlabs: null, slabsReceived: 0, slabs: [fullSlab()] }));
    expect(screen.queryByTestId('slab-progress')).not.toBeInTheDocument();
  });
});

describe('SlabRowsEditor — paste from packing list', () => {
  it('opens the paste panel, and closes it again', async () => {
    const user = userEvent.setup();
    renderLine(lineWith({}));
    expect(screen.queryByRole('group', { name: 'Paste from packing list' })).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Paste slabs from a packing list for Absolute Black' });
    await user.click(toggle);
    expect(screen.getByRole('group', { name: 'Paste from packing list' })).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(screen.queryByRole('group', { name: 'Paste from packing list' })).not.toBeInTheDocument();
  });

  it('adds pasted slabs after the ones already entered', async () => {
    const user = userEvent.setup();
    const onSlabs = vi.fn();
    renderLine(lineWith({ slabs: [fullSlab({ lot: 'existing' })] }), onSlabs);

    await user.click(screen.getByRole('button', { name: 'Paste slabs from a packing list for Absolute Black' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Packing list rows' }), {
      target: { value: '3000\t1500\t30\tB-9\n3010\t1490\t30\tB-9' },
    });
    await user.click(screen.getByRole('button', { name: 'Add 2 slabs' }));

    const next = onSlabs.mock.calls.at(-1)?.[0] as ItemReceiptDraftSlab[];
    expect(next).toHaveLength(3);
    expect(next[0].lot).toBe('existing');
    expect(next.slice(1).map((s) => [s.lengthMm, s.lot])).toEqual([['3000', 'B-9'], ['3010', 'B-9']]);
    // The panel closes, and the rows now show in the table.
    expect(screen.queryByRole('group', { name: 'Paste from packing list' })).not.toBeInTheDocument();
    expect(screen.getByText('3 slabs')).toBeInTheDocument();
  });
});

describe('SlabRowsEditor — set lot / block for all', () => {
  it('is not offered until there is a slab', () => {
    renderLine(lineWith({ slabs: [] }));
    expect(screen.queryByRole('button', { name: /Set lot and block for all slabs/ })).not.toBeInTheDocument();
  });

  it('stamps the lot on every slab and leaves the block IDs already entered', async () => {
    const user = userEvent.setup();
    const onSlabs = vi.fn();
    renderLine(lineWith({ slabs: [fullSlab({ blockId: 'keep-1' }), fullSlab({ blockId: 'keep-2' }), fullSlab()] }), onSlabs);

    await user.click(screen.getByRole('button', { name: 'Set lot and block for all slabs of Absolute Black' }));
    await user.type(screen.getByRole('textbox', { name: 'Lot for all slabs' }), 'B-1234');
    await user.click(screen.getByRole('button', { name: 'Apply to all slabs' }));

    const next = onSlabs.mock.calls.at(-1)?.[0] as ItemReceiptDraftSlab[];
    expect(next.map((s) => s.lot)).toEqual(['B-1234', 'B-1234', 'B-1234']);
    expect(next.map((s) => s.blockId)).toEqual(['keep-1', 'keep-2', '']);
  });
});
