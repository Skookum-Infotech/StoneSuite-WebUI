import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/inventoryService', () => ({
  inventoryService: { searchItems: vi.fn(), searchKits: vi.fn(), getKit: vi.fn() },
}));
// The slab is sold by the square foot, the sink by the piece.
vi.mock('@/hooks/useItemUnitCode', () => ({ useItemUnitCode: () => (i: { id: string }) => (i.id === 'i-slab' ? 'SQFT' : 'EA') }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

import { EstimateItemsTab } from './EstimateItemsTab';
import { QuoteItemsTab } from './QuoteItemsTab';
import { SalesOrderItemsTab } from './SalesOrderItemsTab';
import { InvoiceItemsTab } from './InvoiceItemsTab';
import { inventoryService } from '@/services/inventoryService';
import type { EstimateLineItem } from '@/lib/estimateForm';
import type { QuoteLineItem } from '@/lib/quoteForm';
import type { SOLineItem } from '@/lib/salesOrderForm';
import type { InvoiceLineItem } from '@/lib/invoiceForm';
import type { InventoryItem } from '@/types/inventory';

function item(over: Partial<InventoryItem>): InventoryItem {
  return {
    id: 'item', sku: 'SKU', name: 'Item', description: '', unitId: 1, unitPrice: 10, isActive: true,
    customFields: {}, tracking: 'quantity', thicknessMm: 0, barcode: '', createdAt: '', updatedAt: '', ...over,
  };
}

// A 120 x 60 in slab, 3/4 in thick: 3048 x 1524 x 19.05 mm. One slab is 50 sq ft.
const SLAB = item({
  id: 'i-slab', sku: 'CAL-1', name: 'Calacatta', dimensionUnit: 'in', lengthMm: 3048, widthMm: 1524, thicknessMm: 19.05,
});
const SINK = item({ id: 'i-sink', sku: 'SNK-1', name: 'Sink', unitPrice: 250, dimensionUnit: 'in' });

function EstimateHarness() {
  const [items, setItems] = useState<EstimateLineItem[]>([]);
  return <EstimateItemsTab items={items} onUpdate={setItems} headerTaxPercent={0} />;
}
function QuoteHarness() {
  const [items, setItems] = useState<QuoteLineItem[]>([]);
  return <QuoteItemsTab items={items} onUpdate={setItems} headerTaxPercent={0} />;
}
function OrderHarness() {
  const [items, setItems] = useState<SOLineItem[]>([]);
  return <SalesOrderItemsTab items={items} onUpdate={setItems} />;
}
function InvoiceHarness() {
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  return <InvoiceItemsTab items={items} onUpdate={setItems} headerTaxPercent={0} />;
}

const HARNESSES: Array<[string, () => React.ReactElement]> = [
  ['Estimate', EstimateHarness],
  ['Quote', QuoteHarness],
  ['Sales order', OrderHarness],
  ['Invoice', InvoiceHarness],
];

function renderWith(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

async function pickItem(user: ReturnType<typeof userEvent.setup>, search: string, name: string) {
  await user.click(screen.getByRole('button', { name: 'Add Line' }));
  await user.type(screen.getByRole('combobox', { name: 'Item Name' }), search);
  await user.click(await screen.findByRole('option', { name: new RegExp(`^${name}`) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(inventoryService.searchItems).mockResolvedValue({ records: [SLAB, SINK], nextCursor: '', hasMore: false });
  vi.mocked(inventoryService.searchKits).mockResolvedValue({ records: [], nextCursor: '', hasMore: false });
});

describe.each(HARNESSES)('%s items table — slab defaults from the picked item', (_name, Harness) => {
  it('has a Thick column right after Width, before Slabs', () => {
    renderWith(<Harness />);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers.indexOf('Thick')).toBe(headers.indexOf('W') + 1);
    expect(headers.indexOf('Slabs')).toBe(headers.indexOf('Thick') + 1);
  });

  it('fills length, width and thickness from a slab item and works the quantity out', async () => {
    const user = userEvent.setup();
    renderWith(<Harness />);

    await pickItem(user, 'Cal', 'Calacatta');

    expect(screen.getByRole('textbox', { name: 'Length (in)' })).toHaveValue('120');
    expect(screen.getByRole('textbox', { name: 'Width (in)' })).toHaveValue('60');
    expect(screen.getByRole('textbox', { name: 'Thickness (in)' })).toHaveValue('0.75');
    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue(50); // one 120 x 60 in slab
  });

  it('lets the user overwrite the filled-in size', async () => {
    const user = userEvent.setup();
    renderWith(<Harness />);
    await pickItem(user, 'Cal', 'Calacatta');

    await user.type(screen.getByRole('textbox', { name: 'Length (in)' }), '60'); // focus selects, so this replaces
    expect(screen.getByRole('textbox', { name: 'Length (in)' })).toHaveValue('60');
    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue(25);
  });

  it('folds the size cells away for a piece-priced item and keeps quantity typeable', async () => {
    const user = userEvent.setup();
    renderWith(<Harness />);

    await pickItem(user, 'Sin', 'Sink');

    expect(screen.queryByRole('textbox', { name: /^Length/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^Width/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Slabs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^Thickness/ })).not.toBeInTheDocument();
    const qty = screen.getByRole('spinbutton', { name: 'Quantity' });
    expect(qty).not.toHaveAttribute('readonly');
    await user.clear(qty);
    await user.type(qty, '2');
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveValue('$500.00'); // 2 x $250
  });

  it('shows a saved piece-priced line as one dash across the size columns, with its quantity', async () => {
    const user = userEvent.setup();
    renderWith(<Harness />);
    await pickItem(user, 'Sin', 'Sink');
    await user.type(screen.getByRole('spinbutton', { name: 'Quantity' }), '3');
    await user.click(screen.getByRole('button', { name: 'Save Line' }));

    const row = screen.getByRole('row', { name: /Sink/ });
    const merged = within(row).getAllByRole('cell').find((c) => c.getAttribute('colspan') === '4');
    expect(merged).toHaveTextContent('—');
    expect(row).toHaveTextContent('SNK-1');
  });

  it('shows a saved slab line with its size and thickness', async () => {
    const user = userEvent.setup();
    renderWith(<Harness />);
    await pickItem(user, 'Cal', 'Calacatta');
    await user.click(screen.getByRole('button', { name: 'Save Line' }));

    const row = screen.getByRole('row', { name: /Calacatta/ });
    expect(row).toHaveTextContent('120 in');
    expect(row).toHaveTextContent('60 in');
    expect(row).toHaveTextContent('0.75 in');
  });
});
