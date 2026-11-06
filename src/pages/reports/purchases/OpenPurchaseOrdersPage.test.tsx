import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { OpenPoRow } from '@/types/reports';

vi.mock('@/services/reportsService', () => ({ reportsService: { openPurchaseOrders: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import OpenPurchaseOrdersPage from './OpenPurchaseOrdersPage';
import { reportsService } from '@/services/reportsService';

const ROW: OpenPoRow = {
  id: 'po-1', number: 'PORD-000007', vendor: 'Stone Co', status: 'Partially Received',
  orderDate: '2026-10-01', expectedDate: '2026-10-20', value: 1000, outstanding: 400, receivedPercent: 60, daysOverdue: 17,
};

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/reports/purchases/open-pos']}>
        <Routes>
          <Route path="/reports/purchases/open-pos" element={<OpenPurchaseOrdersPage />} />
          <Route path="/purchases/purchase_order/:id" element={<p>po page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OpenPurchaseOrdersPage', () => {
  it('lists the order with its lateness and summarises late orders', async () => {
    vi.mocked(reportsService.openPurchaseOrders).mockResolvedValue({
      totals: { count: 1, outstanding: 400, overdueCount: 1, overdueValue: 400 },
      rows: [ROW],
    });
    renderPage();
    expect(await screen.findByText('17 days late')).toBeInTheDocument();
    expect(screen.getByLabelText('Report totals')).toHaveTextContent('Late orders1');
  });

  it('opens the purchase order when its number is chosen', async () => {
    vi.mocked(reportsService.openPurchaseOrders).mockResolvedValue({
      totals: { count: 1, outstanding: 400, overdueCount: 1, overdueValue: 400 },
      rows: [ROW],
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Open PORD-000007' }));
    expect(await screen.findByText('po page')).toBeInTheDocument();
  });

  it('says so when nothing is waiting on goods', async () => {
    vi.mocked(reportsService.openPurchaseOrders).mockResolvedValue({
      totals: { count: 0, outstanding: 0, overdueCount: 0, overdueValue: 0 },
      rows: [],
    });
    renderPage();
    expect(await screen.findByText('No purchase orders are waiting on goods.')).toBeInTheDocument();
  });
});
