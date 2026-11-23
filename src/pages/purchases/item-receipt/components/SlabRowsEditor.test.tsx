import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
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
  inventoryService: { getItem: vi.fn().mockResolvedValue({ id: 'item-1', thicknessMm: 30, dimensionUnit: 'mm' }) },
}));

import { SlabRowsEditor } from './SlabRowsEditor';
import { inventoryBinService } from '@/services/inventoryBinService';
import { inventoryService } from '@/services/inventoryService';
import { newDraftSlab, GROUPED_ROW_THRESHOLD, type ItemReceiptDraftSlab } from '@/lib/itemReceiptSlabs';
import type { ItemReceiptDraftLine } from '@/lib/itemReceiptForm';

function line(slabs: ItemReceiptDraftSlab[], over: Partial<ItemReceiptDraftLine> = {}): ItemReceiptDraftLine {
  return {
    purchaseOrderItemId: 'poi-1', lineNumber: 1, itemName: 'Absolute Black', sku: 'AB-30',
    description: '', unitCode: 'SQFT', qtyOrdered: 500, qtyAlreadyReceived: 0,
    qtyReceived: '', qtyRejected: '0', lineNotes: '', tracking: 'serialized', slabs, dimensionUnit: 'mm',
    ...over,
  };
}

// 3048 x 1524 mm is exactly 10 ft x 5 ft = 50 sq ft.
const fullSlab = (over: Partial<ItemReceiptDraftSlab> = {}) =>
  newDraftSlab({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30', ...over });

// The editor is controlled, so the tests drive it through a parent that owns
// the slabs, the way ReceiptLinesTable does.
function Harness({ initial, serials = [], problems = [], warehouseId = 'wh-1', onSlabs, lineOver }: {
  initial: ItemReceiptDraftSlab[];
  lineOver?: Partial<ItemReceiptDraftLine>;
  serials?: string[];
  problems?: string[];
  warehouseId?: string;
  onSlabs?: (s: ItemReceiptDraftSlab[]) => void;
}) {
  const [slabs, setSlabs] = useState(initial);
  return (
    <SlabRowsEditor
      line={line(slabs, lineOver)}
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
    await user.click(bin);
    await user.click(await screen.findByRole('option', { name: /Rack A/ }));

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

describe('SlabRowsEditor — arrived count', () => {
  const ordered = { inventoryItemId: 'item-1', expectedSlabs: 5, slabsReceived: 0, defaultLengthMm: 3048, defaultWidthMm: 1524 };

  it('generates the outstanding slab count prefilled from the ordered size and the item thickness', async () => {
    const user = userEvent.setup();
    renderEditor({ initial: [], lineOver: ordered });

    expect(screen.getByRole('spinbutton', { name: 'Slabs arrived on this receipt' })).toHaveValue(5);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate rows for Absolute Black' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Generate rows for Absolute Black' }));

    expect(screen.getByText('5 slabs')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Length (mm) of slab 5' })).toHaveValue(3048);
    expect(screen.getByRole('spinbutton', { name: 'Width (mm) of slab 5' })).toHaveValue(1524);
    expect(await screen.findByRole('spinbutton', { name: 'Thickness (mm) of slab 5' })).toHaveValue(30);
  });

  it('starts from what is still outstanding after earlier receipts', () => {
    renderEditor({ initial: [], lineOver: { ...ordered, slabsReceived: 2 } });
    expect(screen.getByRole('spinbutton', { name: 'Slabs arrived on this receipt' })).toHaveValue(3);
  });

  it.each([
    ['blank', '', /Enter how many slabs arrived/],
    ['zero', '0', /whole number of slabs/],
    ['fractional', '2.5', /whole number of slabs/],
    ['past the limit', '501', /up to 500 slabs/],
  ])('disables Generate rows for a %s count and says why', async (_name, typed, reason) => {
    const user = userEvent.setup();
    renderEditor({ initial: [], lineOver: ordered });
    const count = screen.getByRole('spinbutton', { name: 'Slabs arrived on this receipt' });

    await user.clear(count);
    if (typed) await user.type(count, typed);

    expect(screen.getByRole('button', { name: 'Generate rows for Absolute Black' })).toBeDisabled();
    expect(screen.getByText(reason)).toBeInTheDocument();
  });

  it('tops the line up to the typed count rather than adding a second batch', async () => {
    const user = userEvent.setup();
    renderEditor({ initial: [fullSlab(), fullSlab()], lineOver: ordered });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate rows for Absolute Black' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Generate rows for Absolute Black' }));
    expect(screen.getByText('5 slabs')).toBeInTheDocument();

    // Nothing left to add, so a second press has nothing to do.
    expect(screen.getByRole('button', { name: 'Generate rows for Absolute Black' })).toBeDisabled();
    expect(screen.getByText(/already has 5 slab rows/)).toBeInTheDocument();
  });
});

describe('SlabRowsEditor — grouped rows', () => {
  const many = (n: number) => Array.from({ length: n }, () => fullSlab());

  it('shows every slab on its own row at the grouping threshold', () => {
    renderEditor({ initial: many(GROUPED_ROW_THRESHOLD) });
    expect(screen.getByRole('spinbutton', { name: 'Length (mm) of slab 1' })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Length (mm) of group 1' })).not.toBeInTheDocument();
  });

  it('collapses identical slabs into one group row above it', () => {
    renderEditor({ initial: many(GROUPED_ROW_THRESHOLD + 1) });
    const [, groupRow] = screen.getAllByRole('row');
    expect(within(groupRow).getByText(`${GROUPED_ROW_THRESHOLD + 1} slabs`)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Length (mm) of group 1' })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Length (mm) of slab 1' })).not.toBeInTheDocument();
  });

  it('edits every slab in a group at once', () => {
    const onSlabs = vi.fn();
    renderEditor({ initial: many(GROUPED_ROW_THRESHOLD + 1), onSlabs });

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Length (mm) of group 1' }), { target: { value: '3100' } });

    const next = onSlabs.mock.calls.at(-1)?.[0] as ItemReceiptDraftSlab[];
    expect(next).toHaveLength(GROUPED_ROW_THRESHOLD + 1);
    expect(next.every((s) => s.lengthMm === '3100')).toBe(true);
  });

  it('opens one group slab by slab and keeps a hand-edited slab out of the group', async () => {
    const user = userEvent.setup();
    renderEditor({ initial: many(GROUPED_ROW_THRESHOLD + 1) });

    await user.click(screen.getByRole('button', { name: 'Edit group 1 slab by slab' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Length (mm) of slab 3' }), { target: { value: '2900' } });

    expect(screen.getByRole('spinbutton', { name: 'Length (mm) of slab 3' })).toHaveValue(2900);
    // The 26th slab is on the next page of the slabs opened one by one.
    await user.click(screen.getByRole('button', { name: 'Next page of slabs' }));
    expect(screen.getByRole('spinbutton', { name: `Length (mm) of slab ${GROUPED_ROW_THRESHOLD + 1}` })).toHaveValue(3048);
  });
});

function measuredIn(unit: string) {
  vi.mocked(inventoryService.getItem).mockResolvedValue({ id: 'item-1', thicknessMm: 30, dimensionUnit: unit } as never);
}

describe('SlabRowsEditor — sizes in the item own unit', () => {
  afterEach(() => measuredIn('mm'));

  it('shows an inch item in inches, in the headings and in every field', async () => {
    measuredIn('in');
    renderEditor({ initial: [fullSlab()], lineOver: { inventoryItemId: 'item-1' } });

    expect(await screen.findByRole('columnheader', { name: 'Length (in) *' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Length (in) of slab 1' })).toHaveValue(120);
    expect(screen.getByRole('spinbutton', { name: 'Width (in) of slab 1' })).toHaveValue(60);
    expect(screen.getByRole('spinbutton', { name: 'Thickness (in) of slab 1' })).toHaveValue(1.18);
    expect(screen.queryByText(/\(mm\)/)).not.toBeInTheDocument();
  });

  it('stores what is typed in inches as millimetres', async () => {
    measuredIn('in');
    const onSlabs = vi.fn();
    renderEditor({ initial: [fullSlab()], lineOver: { inventoryItemId: 'item-1' }, onSlabs });
    await screen.findByRole('columnheader', { name: 'Width (in) *' });

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Width (in) of slab 1' }), { target: { value: '96' } });

    expect((onSlabs.mock.calls.at(-1)?.[0] as ItemReceiptDraftSlab[])[0].widthMm).toBe('2438.4');
  });

  it('gives a generated slab the ordered size, shown in inches', async () => {
    measuredIn('in');
    const user = userEvent.setup();
    renderEditor({ initial: [], lineOver: { inventoryItemId: 'item-1', expectedSlabs: 2, slabsReceived: 0, defaultLengthMm: 3048, defaultWidthMm: 1524 } });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate rows for Absolute Black' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Generate rows for Absolute Black' }));

    expect(screen.getByRole('spinbutton', { name: 'Length (in) of slab 2' })).toHaveValue(120);
    expect(screen.getByRole('spinbutton', { name: 'Width (in) of slab 2' })).toHaveValue(60);
  });

  it('follows an item measured in centimetres', async () => {
    measuredIn('cm');
    renderEditor({ initial: [fullSlab()], lineOver: { inventoryItemId: 'item-1' } });

    expect(await screen.findByRole('spinbutton', { name: 'Length (cm) of slab 1' })).toHaveValue(304.8);
  });
});

describe('SlabRowsEditor — a bin for many slabs at once', () => {
  const many = (n: number) => Array.from({ length: n }, () => fullSlab());
  const pickBin = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(screen.getByRole('combobox', { name }));
    await user.click(await screen.findByRole('option', { name: /Rack A/ }));
  };

  it('puts every slab on the line in one bin', async () => {
    const user = userEvent.setup();
    const onSlabs = vi.fn();
    renderEditor({ initial: many(40), onSlabs });

    await user.click(screen.getByRole('button', { name: 'Assign a bin to slabs of Absolute Black' }));
    await pickBin(user, 'Bin to assign');
    await user.click(screen.getByRole('button', { name: 'Assign bin to slabs' }));

    const next = onSlabs.mock.calls.at(-1)?.[0] as ItemReceiptDraftSlab[];
    expect(next).toHaveLength(40);
    expect(next.every((s) => s.binId === 'bin-1')).toBe(true);
  });

  it('can take just a range of slabs', async () => {
    const user = userEvent.setup();
    const onSlabs = vi.fn();
    renderEditor({ initial: many(10), onSlabs });

    await user.click(screen.getByRole('button', { name: 'Assign a bin to slabs of Absolute Black' }));
    await user.click(screen.getByRole('radio', { name: 'A range of slabs' }));
    await user.type(screen.getByRole('spinbutton', { name: 'From slab' }), '3');
    await user.type(screen.getByRole('spinbutton', { name: 'To slab' }), '6');
    await pickBin(user, 'Bin to assign');
    await user.click(screen.getByRole('button', { name: 'Assign bin to slabs' }));

    const next = onSlabs.mock.calls.at(-1)?.[0] as ItemReceiptDraftSlab[];
    expect(next.map((s) => s.binId)).toEqual(['', '', 'bin-1', 'bin-1', 'bin-1', 'bin-1', '', '', '', '']);
  });

  it('can leave slabs that already have a bin', async () => {
    const user = userEvent.setup();
    const onSlabs = vi.fn();
    renderEditor({ initial: [fullSlab({ binId: 'bin-9' }), fullSlab(), fullSlab()], onSlabs });

    await user.click(screen.getByRole('button', { name: 'Assign a bin to slabs of Absolute Black' }));
    await user.click(screen.getByRole('checkbox', { name: 'Only slabs with no bin yet' }));
    await pickBin(user, 'Bin to assign');
    await user.click(screen.getByRole('button', { name: 'Assign bin to slabs' }));

    expect((onSlabs.mock.calls.at(-1)?.[0] as ItemReceiptDraftSlab[]).map((s) => s.binId)).toEqual(['bin-9', 'bin-1', 'bin-1']);
  });

  it('says how many slabs it will change before it does', async () => {
    const user = userEvent.setup();
    renderEditor({ initial: [fullSlab({ binId: 'bin-9' }), fullSlab(), fullSlab()] });

    await user.click(screen.getByRole('button', { name: 'Assign a bin to slabs of Absolute Black' }));
    expect(screen.getByText('Sets the bin on 3 slabs.')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Only slabs with no bin yet' }));

    expect(screen.getByText('Sets the bin on 2 slabs.')).toBeInTheDocument();
  });

  it('starts generated slabs in the chosen bin', async () => {
    const user = userEvent.setup();
    const onSlabs = vi.fn();
    renderEditor({ initial: [], lineOver: { inventoryItemId: 'item-1', expectedSlabs: 3, slabsReceived: 0 }, onSlabs });

    await pickBin(user, 'Bin for new slabs');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate rows for Absolute Black' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Generate rows for Absolute Black' }));

    expect((onSlabs.mock.calls.at(-1)?.[0] as ItemReceiptDraftSlab[]).map((s) => s.binId)).toEqual(['bin-1', 'bin-1', 'bin-1']);
  });
});

describe('SlabRowsEditor — a long delivery is paged', () => {
  const distinct = (n: number) => Array.from({ length: n }, (_, i) => fullSlab({ lengthMm: String(3000 + i) }));

  it('shows a page of groups at a time and walks through the rest', async () => {
    const user = userEvent.setup();
    renderEditor({ initial: distinct(60) });

    expect(screen.getByText('Groups 1–25 of 60')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Length (mm) of group 25' })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Length (mm) of group 26' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next page of groups' }));

    expect(screen.getByText('Groups 26–50 of 60')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Length (mm) of group 26' })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Length (mm) of group 25' })).not.toBeInTheDocument();
  });

  it('pages slabs opened one by one, keeping their real positions', async () => {
    const user = userEvent.setup();
    renderEditor({ initial: Array.from({ length: 60 }, () => fullSlab()) });
    await user.click(screen.getByRole('button', { name: 'Edit group 1 slab by slab' }));

    expect(screen.getByText('Slabs 1–25 of 60')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Length (mm) of slab 26' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next page of slabs' }));

    expect(screen.getByRole('spinbutton', { name: 'Length (mm) of slab 26' })).toBeInTheDocument();
    expect(screen.getByText('Slabs 26–50 of 60')).toBeInTheDocument();
  });

  it('has no pager for a short delivery', () => {
    renderEditor({ initial: distinct(10) });

    expect(screen.queryByRole('button', { name: /Next page/ })).not.toBeInTheDocument();
  });
});
