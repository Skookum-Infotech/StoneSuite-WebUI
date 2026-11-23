import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/inventoryService', () => ({
  inventoryService: { searchItems: vi.fn(), searchKits: vi.fn(), getKit: vi.fn() },
}));
vi.mock('@/hooks/useItemUnitCode', () => ({ useItemUnitCode: () => () => 'EA' }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

import { QuoteItemsTab } from './QuoteItemsTab';
import { SalesOrderItemsTab } from './SalesOrderItemsTab';
import { inventoryService } from '@/services/inventoryService';
import { toast } from 'sonner';
import type { QuoteLineItem } from '@/lib/quoteForm';
import type { SOLineItem } from '@/lib/salesOrderForm';
import type { InventoryItem, InventoryKit } from '@/types/inventory';

function item(over: Partial<InventoryItem>): InventoryItem {
  return {
    id: 'item', sku: 'SKU', name: 'Item', description: '', unitId: 1, unitPrice: 100, isActive: true,
    customFields: {}, tracking: 'quantity', thicknessMm: 0, barcode: '', createdAt: '', updatedAt: '', ...over,
  };
}

const COUNTERTOP = item({ id: 'i-ctr', sku: 'CTR-01', name: 'Countertop', unitPrice: 100 });
const SINK = item({ id: 'i-snk', sku: 'SNK-01', name: 'Sink', unitPrice: 50 });
const RETIRED = item({ id: 'i-old', sku: 'OLD-01', name: 'Old Faucet', isActive: false });

function kit(over: Partial<InventoryKit> = {}): InventoryKit {
  return {
    id: 'kit-1', name: 'Kitchen', description: '', isActive: true, itemCount: 2,
    members: [{ quantity: 2, item: COUNTERTOP }, { quantity: 1, item: SINK }],
    createdAt: '', updatedAt: '', ...over,
  };
}

const KITCHEN_ROW = { ...kit(), members: undefined } as InventoryKit; // a search row: count, no members

function quoteLine(over: Partial<QuoteLineItem> = {}): QuoteLineItem {
  return {
    id: 'q-1', lineNo: 1, itemName: 'Loose Slab', itemDescription: '', itemSku: 'LS-1', units: 'EA',
    quantity: '1', unitPrice: '10', discount: '0', amount: '10.00', total: '10.00',
    inventoryItemUuid: 'i-loose', ...over,
  };
}

function QuoteHarness({ initial = [] }: { initial?: QuoteLineItem[] }) {
  const [items, setItems] = useState<QuoteLineItem[]>(initial);
  return <QuoteItemsTab items={items} onUpdate={setItems} headerTaxPercent={0} />;
}

function OrderHarness({ initial = [] }: { initial?: SOLineItem[] }) {
  const [items, setItems] = useState<SOLineItem[]>(initial);
  return <SalesOrderItemsTab items={items} onUpdate={setItems} />;
}

function renderWith(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

async function pickKitByTyping(user: ReturnType<typeof userEvent.setup>, text = 'Kitch') {
  await user.click(screen.getByRole('button', { name: 'Add Line' }));
  await user.type(screen.getByRole('combobox', { name: 'Item Name' }), text);
  await user.click(await screen.findByRole('option', { name: /^Kitchen KIT/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(inventoryService.searchItems).mockResolvedValue({ records: [], nextCursor: '', hasMore: false });
  vi.mocked(inventoryService.searchKits).mockResolvedValue({ records: [KITCHEN_ROW], nextCursor: '', hasMore: false });
  vi.mocked(inventoryService.getKit).mockResolvedValue(kit());
});

describe('Quote items table — adding a kit', () => {
  it('adds the kit under a full-width heading, one line per item at the kit quantity', async () => {
    const user = userEvent.setup();
    renderWith(<QuoteHarness />);

    await pickKitByTyping(user);

    const heading = await screen.findByRole('row', { name: 'Kit Kitchen' });
    expect(heading).toHaveTextContent('2 items');
    expect(within(heading).getAllByRole('cell')).toHaveLength(1); // one cell across the whole row
    expect(inventoryService.getKit).toHaveBeenCalledWith('kit-1');

    const countertop = screen.getByRole('row', { name: /Countertop/ });
    // 2 × $100, shown as the line's amount and again as its total.
    expect(within(countertop).getAllByText('$200.00')).toHaveLength(2);
    expect(screen.getByRole('row', { name: /Sink/ })).toBeInTheDocument();
    // The add row closed: the kit was the line.
    expect(screen.queryByRole('combobox', { name: 'Item Name' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Line' })).toBeInTheDocument();
  });

  it('puts later lines of the same document after the kit, without a heading of their own', async () => {
    const user = userEvent.setup();
    renderWith(<QuoteHarness initial={[quoteLine()]} />);

    await pickKitByTyping(user);
    await screen.findByRole('row', { name: 'Kit Kitchen' });

    const rows = screen.getAllByRole('row').map((r) => r.getAttribute('aria-label') ?? r.textContent ?? '');
    const headingAt = rows.findIndex((r) => r === 'Kit Kitchen');
    const looseAt = rows.findIndex((r) => r.includes('Loose Slab'));
    expect(looseAt).toBeGreaterThan(-1);
    expect(headingAt).toBeGreaterThan(looseAt); // the kit was appended after the existing line
    expect(screen.getAllByRole('row', { name: /^Kit / })).toHaveLength(1);
  });

  it('removes the whole kit with its heading button', async () => {
    const user = userEvent.setup();
    renderWith(<QuoteHarness initial={[quoteLine()]} />);
    await pickKitByTyping(user);
    await screen.findByRole('row', { name: 'Kit Kitchen' });

    await user.click(screen.getByRole('button', { name: 'Remove kit Kitchen and its 2 items' }));

    expect(screen.queryByRole('row', { name: 'Kit Kitchen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Countertop/ })).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Loose Slab/ })).toBeInTheDocument();
  });

  it('removes the heading by itself when its last line is removed', async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryService.getKit).mockResolvedValue(kit({ members: [{ quantity: 1, item: SINK }], itemCount: 1 }));
    renderWith(<QuoteHarness />);
    await pickKitByTyping(user);
    await screen.findByRole('row', { name: 'Kit Kitchen' });

    await user.click(screen.getByRole('button', { name: /Remove line Sink/ }));

    expect(screen.queryByRole('row', { name: 'Kit Kitchen' })).not.toBeInTheDocument();
  });

  it('leaves out an inactive item and says so', async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryService.getKit).mockResolvedValue(
      kit({ members: [{ quantity: 1, item: SINK }, { quantity: 1, item: RETIRED }] }),
    );
    renderWith(<QuoteHarness />);

    await pickKitByTyping(user);

    expect(await screen.findByRole('row', { name: /Sink/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Old Faucet/ })).not.toBeInTheDocument();
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('1 inactive item was left out of “Kitchen”'));
  });

  it('adds nothing, and says why, for a kit with no items', async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryService.getKit).mockResolvedValue(kit({ members: [], itemCount: 0 }));
    renderWith(<QuoteHarness />);

    await pickKitByTyping(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('“Kitchen” has no items yet');
    expect(screen.queryByRole('row', { name: 'Kit Kitchen' })).not.toBeInTheDocument();
  });

  it('reports a failed load and adds nothing', async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryService.getKit).mockRejectedValue(new Error('network down'));
    renderWith(<QuoteHarness />);

    await pickKitByTyping(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not load that kit|network down/);
    expect(screen.queryByRole('row', { name: 'Kit Kitchen' })).not.toBeInTheDocument();
  });

  it('does not offer kits while an existing line is being edited', async () => {
    const user = userEvent.setup();
    renderWith(<QuoteHarness initial={[quoteLine()]} />);

    await user.click(screen.getByRole('button', { name: /Edit line Loose Slab/ }));
    const box = screen.getByRole('combobox', { name: 'Item Name' });
    await user.clear(box);
    await user.type(box, 'Kitch');

    expect(await screen.findByText(/Searching inventory|isn't in inventory/)).toBeInTheDocument();
    expect(inventoryService.searchKits).not.toHaveBeenCalled();
  });

  it('copies the previous line without its kit', async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryService.getKit).mockResolvedValue(kit({ members: [{ quantity: 1, item: SINK }], itemCount: 1 }));
    renderWith(<QuoteHarness />);
    await pickKitByTyping(user);
    await screen.findByRole('row', { name: 'Kit Kitchen' });

    await user.click(screen.getByRole('button', { name: 'Copy Previous' }));
    await user.click(screen.getByRole('button', { name: 'Save Line' }));

    // Two Sink lines now, but only one belongs to the kit: one heading, count 1.
    expect(screen.getAllByRole('row', { name: /Sink/ })).toHaveLength(2);
    expect(screen.getByRole('row', { name: 'Kit Kitchen' })).toHaveTextContent('1 item');
  });
});

describe('Sales order items table — adding a kit', () => {
  it('adds the kit under its heading, with the fulfillment column and all', async () => {
    const user = userEvent.setup();
    renderWith(<OrderHarness />);

    await pickKitByTyping(user);

    const heading = await screen.findByRole('row', { name: 'Kit Kitchen' });
    expect(heading).toHaveTextContent('2 items');
    const countertop = screen.getByRole('row', { name: /Countertop/ });
    expect(within(countertop).getAllByText('Open').length).toBeGreaterThan(0); // fulfillment: nothing filled yet
  });
});
