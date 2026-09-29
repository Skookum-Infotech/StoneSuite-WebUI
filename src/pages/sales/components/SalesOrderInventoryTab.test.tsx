import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/salesOrderService', () => ({ salesOrderService: { getInventory: vi.fn() } }));

import { SalesOrderInventoryTab } from './SalesOrderInventoryTab';
import { salesOrderService } from '@/services/salesOrderService';
import type { SalesOrderInventoryRow } from '@/types/salesOrder';

function renderTab(orderId: string | undefined, rows: SalesOrderInventoryRow[] = []) {
  vi.mocked(salesOrderService.getInventory).mockResolvedValue(rows);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SalesOrderInventoryTab orderId={orderId} />
    </QueryClientProvider>,
  );
}

const row = (over: Partial<SalesOrderInventoryRow> = {}): SalesOrderInventoryRow => ({
  itemId: 'i1', sku: 'GRAN-001', onHand: 100, available: 30, allocated: 70, reservedForOrder: 40,
  salesOrderQuantity: 40, tracked: true, ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('SalesOrderInventoryTab', () => {
  it('tells a new order that stock appears once it is saved', () => {
    renderTab(undefined);

    expect(screen.getByText(/available after saving the order/i)).toBeInTheDocument();
    expect(salesOrderService.getInventory).not.toHaveBeenCalled();
  });

  it('shows what the order holds next to what every order holds and what is free', async () => {
    renderTab('so-1', [row()]);

    const cells = within((await screen.findByText('GRAN-001')).closest('tr') as HTMLElement).getAllByRole('cell');
    expect(cells.map((c) => c.textContent)).toEqual(['GRAN-001', '100', '40', '40', '70', '30']);
    expect(screen.getByRole('columnheader', { name: 'Held for this order' })).toBeInTheDocument();
  });

  it('shows an order that holds everything as having nothing free — not a shortage', async () => {
    renderTab('so-1', [row({ onHand: 40, available: 0, allocated: 40 })]);

    const free = within((await screen.findByText('GRAN-001')).closest('tr') as HTMLElement).getAllByRole('cell')[5];
    expect(free).toHaveTextContent('0');
    expect(free.firstElementChild).not.toHaveClass('text-red-600');
  });

  it('flags a negative free figure — more held than exists', async () => {
    renderTab('so-1', [row({ available: -5 })]);

    const free = within((await screen.findByText('GRAN-001')).closest('tr') as HTMLElement).getAllByRole('cell')[5];
    expect(free.firstElementChild).toHaveClass('text-red-600');
  });

  it('says so for an item whose stock is not tracked', async () => {
    renderTab('so-1', [row({ sku: 'INSTALL-1', tracked: false, onHand: 0, available: 0, allocated: 0, reservedForOrder: 0, salesOrderQuantity: 3 })]);

    const cells = within((await screen.findByText('INSTALL-1')).closest('tr') as HTMLElement).getAllByRole('cell');
    expect(cells[1]).toHaveTextContent('3');
    expect(cells[2]).toHaveTextContent('Stock is not tracked for this item.');
  });

  it('reads a row from an older server (no held/tracked fields) as tracked and holding nothing', async () => {
    renderTab('so-1', [{ itemId: 'i1', sku: 'OLD-1', onHand: 10, available: 10, allocated: 0, salesOrderQuantity: 2 }]);

    const cells = within((await screen.findByText('OLD-1')).closest('tr') as HTMLElement).getAllByRole('cell');
    expect(cells.map((c) => c.textContent)).toEqual(['OLD-1', '10', '2', '0', '0', '10']);
  });
});
