import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/inventoryBinService', () => ({ inventoryBinService: { getTree: vi.fn() } }));

import { OnOrderSlabChecklist, type OnOrderChecklistChange } from './OnOrderSlabChecklist';
import { inventoryBinService } from '@/services/inventoryBinService';
import type { ItemReceiptDraftLine } from '@/lib/itemReceiptForm';
import type { OnOrderSlabDraft } from '@/lib/onOrderSlabs';
import type { Bin } from '@/types/inventory';

const TEN_BY_FIVE_FEET_MM = { lengthMm: 3048, widthMm: 1524 };

function slab(n: number, overrides: Partial<OnOrderSlabDraft> = {}): OnOrderSlabDraft {
  const id = String(n).padStart(3, '0');
  return {
    id: `slab-${id}`, serial: `PORD-000012-${id}`, ...TEN_BY_FIVE_FEET_MM,
    orderedThicknessMm: 30, thicknessMm: '30', arrived: false, binId: '', ...overrides,
  };
}

function lineWith(onOrder: OnOrderSlabDraft[], overrides: Partial<ItemReceiptDraftLine> = {}): ItemReceiptDraftLine {
  return {
    purchaseOrderItemId: 'poi-1', lineNumber: 1, itemName: 'Absolute Black', sku: 'AB-30', description: '',
    unitCode: 'SQFT', qtyOrdered: 150, qtyAlreadyReceived: 0, qtyReceived: '', qtyRejected: '0', lineNotes: '',
    tracking: 'serialized', slabs: [], onOrder, dimensionUnit: 'in',
    ...overrides,
  };
}

const bin = (id: string, name: string): Bin => ({
  id, name, path: name, depth: 0, unitCount: 0, overCapacity: false, children: [],
} as unknown as Bin);

// Keeps the line in state the way the receipt page does, so a tick shows up.
function Harness({ initial, onChangeSpy, problems = [] }: {
  initial: ItemReceiptDraftLine;
  onChangeSpy?: (change: OnOrderChecklistChange) => void;
  problems?: string[];
}) {
  const [line, setLine] = useState(initial);
  return (
    <OnOrderSlabChecklist
      line={line}
      warehouseId="wh-1"
      problems={problems}
      onChange={(change) => { onChangeSpy?.(change); setLine((prev) => ({ ...prev, ...change })); }}
    />
  );
}

function renderChecklist(initial: ItemReceiptDraftLine, extra: { onChangeSpy?: (c: OnOrderChecklistChange) => void; problems?: string[] } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness initial={initial} {...extra} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(inventoryBinService.getTree).mockResolvedValue([bin('bin-1', 'Rack A')]);
});

describe('OnOrderSlabChecklist', () => {
  it('lists every slab with its serial, size in the line\'s unit, thickness and area', () => {
    renderChecklist(lineWith([slab(1), slab(2)]));

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2
    expect(within(rows[1]).getByText('PORD-000012-001')).toBeInTheDocument();
    expect(within(rows[1]).getByText('120')).toBeInTheDocument(); // 3048 mm in inches
    expect(within(rows[1]).getByText('60')).toBeInTheDocument(); // 1524 mm in inches
    expect(within(rows[1]).getByText('1.18')).toBeInTheDocument(); // 30 mm in inches
    expect(within(rows[1]).getByText('50.000')).toBeInTheDocument();
    expect(screen.getByTestId('arrival-progress')).toHaveTextContent('0 of 2 slabs arrived');
  });

  it('names length and width in the unit of the line, each in its own column', () => {
    renderChecklist(lineWith([slab(1)]));

    for (const name of ['Length (in)', 'Width (in)', 'Thickness (in)']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('columnheader', { name: /^Size/ })).not.toBeInTheDocument();
  });

  it('ticks only the slab that was clicked and reports the new list', async () => {
    const spy = vi.fn();
    renderChecklist(lineWith([slab(1), slab(2), slab(3)]), { onChangeSpy: spy });

    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Slab PORD-000012-002 arrived' }));

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0].onOrder.map((d: OnOrderSlabDraft) => d.arrived)).toEqual([false, true, false]);
    expect(screen.getByRole('checkbox', { name: 'Slab PORD-000012-002 arrived' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Slab PORD-000012-001 arrived' })).not.toBeChecked();
    expect(screen.getByTestId('arrival-progress')).toHaveTextContent('1 of 3 slabs arrived');
  });

  it('ticks and clears every slab from the header box', async () => {
    const user = userEvent.setup();
    renderChecklist(lineWith([slab(1), slab(2)]));
    const all = screen.getByRole('checkbox', { name: 'Mark all slabs of Absolute Black as arrived' });

    await user.click(all);
    expect(screen.getByTestId('arrival-progress')).toHaveTextContent('2 of 2 slabs arrived');
    expect(all).toBeChecked();

    await user.click(all);
    expect(screen.getByTestId('arrival-progress')).toHaveTextContent('0 of 2 slabs arrived');
  });

  it('shows the header box as partly ticked while only some are', () => {
    renderChecklist(lineWith([slab(1, { arrived: true }), slab(2)]));

    const all = screen.getByRole('checkbox', { name: 'Mark all slabs of Absolute Black as arrived' }) as HTMLInputElement;
    expect(all.indeterminate).toBe(true);
    expect(all).not.toBeChecked();
  });

  it('shows a thickness the order stated as text, not a box', () => {
    renderChecklist(lineWith([slab(1)]));

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('asks for the thickness of a slab the order left it out of, and keeps it in millimetres', async () => {
    const spy = vi.fn();
    renderChecklist(lineWith([slab(1, { orderedThicknessMm: 0, thicknessMm: '' })]), { onChangeSpy: spy });

    const box = screen.getByRole('spinbutton', { name: 'Thickness (in) of slab PORD-000012-001' });
    await userEvent.setup().type(box, '1');

    // 1 inch is 25.4 mm.
    expect(spy.mock.calls.at(-1)?.[0].onOrder[0].thicknessMm).toBe('25.4');
  });

  it('locks the bin of a slab until it is ticked, then lets it go to a bin of its own', async () => {
    const spy = vi.fn();
    renderChecklist(lineWith([slab(1), slab(2)]), { onChangeSpy: spy });
    const user = userEvent.setup();

    expect(await screen.findByRole('combobox', { name: 'Bin for slab PORD-000012-001' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'Slab PORD-000012-001 arrived' }));
    await user.click(screen.getByRole('combobox', { name: 'Bin for slab PORD-000012-001' }));
    await user.click(await screen.findByRole('option', { name: /Rack A/ }));

    expect(spy.mock.calls.at(-1)?.[0].onOrder.map((d: OnOrderSlabDraft) => d.binId)).toEqual(['bin-1', '']);
    expect(inventoryBinService.getTree).toHaveBeenCalledWith('wh-1');
  });

  it('can leave a ticked slab without a bin again', async () => {
    const spy = vi.fn();
    renderChecklist(lineWith([slab(1, { arrived: true, binId: 'bin-1' })]), { onChangeSpy: spy });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('combobox', { name: 'Bin for slab PORD-000012-001' }));
    await user.click(await screen.findByRole('option', { name: /No bin yet/ }));

    expect(spy.mock.calls.at(-1)?.[0].onOrder[0].binId).toBe('');
  });

  it('sets one bin on every ticked slab at once, leaving the unticked alone', async () => {
    const spy = vi.fn();
    renderChecklist(lineWith([slab(1, { arrived: true }), slab(2), slab(3, { arrived: true })]), { onChangeSpy: spy });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('combobox', { name: 'Set bin for ticked slabs' }));
    await user.click(await screen.findByRole('option', { name: /Rack A/ }));

    expect(spy.mock.calls.at(-1)?.[0].onOrder.map((d: OnOrderSlabDraft) => d.binId)).toEqual(['bin-1', '', 'bin-1']);
  });

  it('offers the all-at-once bin only once something is ticked', async () => {
    renderChecklist(lineWith([slab(1)]));

    expect(await screen.findByRole('combobox', { name: 'Set bin for ticked slabs' })).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Slab PORD-000012-001 arrived' }));
    expect(screen.getByRole('combobox', { name: 'Set bin for ticked slabs' })).toBeEnabled();
  });

  it('pages a long delivery and keeps ticks across pages', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 30 }, (_, i) => slab(i + 1));
    renderChecklist(lineWith(many));

    expect(screen.getAllByRole('row')).toHaveLength(26); // header + 25
    await user.click(screen.getByRole('checkbox', { name: 'Slab PORD-000012-001 arrived' }));
    await user.click(screen.getByRole('button', { name: 'Next page of slabs' }));

    expect(screen.getAllByRole('row')).toHaveLength(6); // header + the last 5
    expect(screen.queryByText('PORD-000012-001')).not.toBeInTheDocument();
    expect(screen.getByTestId('arrival-progress')).toHaveTextContent('1 of 30 slabs arrived');
  });

  it('lists what is still wrong with the ticked slabs', () => {
    renderChecklist(lineWith([slab(1)]), { problems: ['Slab PORD-000012-001: thickness must be greater than zero.'] });

    expect(screen.getByRole('alert')).toHaveTextContent('thickness must be greater than zero');
  });
});
