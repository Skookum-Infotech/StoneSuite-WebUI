import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { LowStockRow } from '@/types/reports';

vi.mock('@/services/reportsService', () => ({ reportsService: { lowStock: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import LowStockPage from './LowStockPage';
import { reportsService } from '@/services/reportsService';

const ROW: LowStockRow = {
  itemId: 'item-1', sku: 'G-1', name: 'Black Granite', unit: 'SQFT', location: 'Main',
  onHand: 0, allocated: 0, available: 0, reorderPoint: 200, onOrder: 50, suggestedOrder: 150, state: 'out',
};

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/reports/inventory/low-stock']}>
        <Routes>
          <Route path="/reports/inventory/low-stock" element={<LowStockPage />} />
          <Route path="/inventory/item/:id" element={<p>item page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LowStockPage', () => {
  it('shows the state and the suggested order for a depleted item', async () => {
    vi.mocked(reportsService.lowStock).mockResolvedValue({ totals: { rows: 1, outOfStock: 1, items: 1 }, rows: [ROW] });
    renderPage();
    const table = await screen.findByRole('table', { name: 'Low stock' });
    expect(within(table).getByText('Out of stock')).toBeInTheDocument();
    expect(within(table).getByText('150 SQFT')).toBeInTheDocument();
    expect(screen.getByLabelText('Report totals')).toHaveTextContent('Out of stock1');
  });

  it('opens the item when a row is chosen', async () => {
    vi.mocked(reportsService.lowStock).mockResolvedValue({ totals: { rows: 1, outOfStock: 1, items: 1 }, rows: [ROW] });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Open Black Granite' }));
    expect(await screen.findByText('item page')).toBeInTheDocument();
  });

  it('explains that only items with a reorder point are checked when the list is empty', async () => {
    vi.mocked(reportsService.lowStock).mockResolvedValue({ totals: { rows: 0, outOfStock: 0, items: 0 }, rows: [] });
    renderPage();
    expect(await screen.findByText(/Only items with a reorder point set are checked/)).toBeInTheDocument();
  });
});
