import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState, type ReactElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/inventoryService', () => ({
  inventoryService: { searchItems: vi.fn(), searchKits: vi.fn(), getKit: vi.fn() },
}));
vi.mock('@/hooks/useItemUnitCode', () => ({ useItemUnitCode: () => () => 'EA' }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

import { PurchaseOrderItemsTab } from './purchase-order/components/PurchaseOrderItemsTab';
import { VendorBillItemsTab } from './vendor-bill/components/VendorBillItemsTab';
import { RequisitionLinesTable } from './requisition/components/RequisitionLinesTable';
import { inventoryService } from '@/services/inventoryService';
import type { PurchaseOrderLineItem } from '@/lib/purchaseOrderForm';
import type { VendorBillLineItem } from '@/lib/vendorBillForm';
import type { RequisitionLineItem } from '@/lib/requisitionForm';
import type { InventoryItem, InventoryKit } from '@/types/inventory';

function item(over: Partial<InventoryItem>): InventoryItem {
  return {
    id: 'item', sku: 'SKU', name: 'Item', description: '', unitId: 1, unitPrice: 100, isActive: true,
    customFields: {}, tracking: 'quantity', thicknessMm: 0, barcode: '', createdAt: '', updatedAt: '', ...over,
  };
}

const COUNTERTOP = item({ id: 'i-ctr', sku: 'CTR-01', name: 'Countertop' });
const SINK = item({ id: 'i-snk', sku: 'SNK-01', name: 'Sink' });
const KITCHEN: InventoryKit = {
  id: 'kit-1', name: 'Kitchen', description: '', isActive: true, itemCount: 2,
  members: [{ quantity: 2, item: COUNTERTOP }, { quantity: 1, item: SINK }],
  createdAt: '', updatedAt: '',
};
const KITCHEN_ROW = { ...KITCHEN, members: undefined } as InventoryKit; // a search row: count, no members

function PoHarness() {
  const [items, setItems] = useState<PurchaseOrderLineItem[]>([]);
  return <PurchaseOrderItemsTab items={items} onUpdate={setItems} headerTaxPercent={0} />;
}
function BillHarness() {
  const [items, setItems] = useState<VendorBillLineItem[]>([]);
  return <VendorBillItemsTab items={items} onUpdate={setItems} headerTaxPercent={0} />;
}
function ReqnHarness() {
  const [items, setItems] = useState<RequisitionLineItem[]>([]);
  return <RequisitionLinesTable items={items} onUpdate={setItems} />;
}

function renderWith(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

async function pickKitchenKit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Add Line' }));
  await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'Kitch');
  await user.click(await screen.findByRole('option', { name: /^Kitchen KIT/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(inventoryService.searchItems).mockResolvedValue({ records: [], nextCursor: '', hasMore: false });
  vi.mocked(inventoryService.searchKits).mockResolvedValue({ records: [KITCHEN_ROW], nextCursor: '', hasMore: false });
  vi.mocked(inventoryService.getKit).mockResolvedValue(KITCHEN);
});

describe.each([
  { table: 'Purchase Order', ui: () => <PoHarness /> },
  { table: 'Vendor Bill', ui: () => <BillHarness /> },
  { table: 'Requisition', ui: () => <ReqnHarness /> },
])('$table items table — adding a kit', ({ ui }) => {
  it('groups the kit\'s lines under one full-width, coloured kit heading', async () => {
    const user = userEvent.setup();
    renderWith(ui());

    await pickKitchenKit(user);

    const heading = await screen.findByRole('row', { name: 'Kit Kitchen' });
    expect(heading).toHaveTextContent('2 items');
    const cells = within(heading).getAllByRole('cell');
    expect(cells).toHaveLength(1);
    expect(cells[0]).toHaveAttribute('colspan', String(screen.getAllByRole('columnheader').length));
    expect(screen.getByRole('row', { name: /Countertop/ }).className).toContain('bg-violet-50');
    expect(screen.getByRole('row', { name: /Sink/ }).className).toContain('bg-violet-50');
  });

  it('removes the whole group from the heading\'s remove button', async () => {
    const user = userEvent.setup();
    renderWith(ui());
    await pickKitchenKit(user);

    await user.click(await screen.findByRole('button', { name: 'Remove kit Kitchen and its 2 items' }));

    expect(screen.queryByRole('row', { name: 'Kit Kitchen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Countertop/ })).not.toBeInTheDocument();
  });
});
