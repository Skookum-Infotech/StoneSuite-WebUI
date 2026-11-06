import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ApAgingReport } from '@/types/reports';

vi.mock('@/services/reportsService', () => ({ reportsService: { apAging: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../components/ReportTopBarChart', () => ({ ReportTopBarChart: () => null }));

import ApAgingPage from './ApAgingPage';
import { reportsService } from '@/services/reportsService';
import { formatMoney } from '@/lib/formatMoney';

const REPORT: ApAgingReport = {
  labels: ['Current', '1-30 days', '31-60 days', '61-90 days', 'Over 90 days'],
  totals: { bills: 2, buckets: [10, 0, 40, 0, 0], total: 50 },
  rows: [{ vendorId: 'vend-1', name: 'Stone Co', bills: 2, buckets: [10, 0, 40, 0, 0], total: 50 }],
};

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/reports/purchases/ap-aging']}>
        <Routes>
          <Route path="/reports/purchases/ap-aging" element={<ApAgingPage />} />
          <Route path="/purchases/vendor/:id" element={<p>vendor page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ApAgingPage', () => {
  it('shows one column per aging bucket and the total owed', async () => {
    vi.mocked(reportsService.apAging).mockResolvedValue(REPORT);
    renderPage();
    const table = await screen.findByRole('table', { name: 'AP aging' });
    for (const label of REPORT.labels) expect(table).toHaveTextContent(label);
    expect(screen.getByLabelText('Report totals')).toHaveTextContent(`Total owed${formatMoney(50)}`);
  });

  it('opens the vendor when a row is chosen', async () => {
    vi.mocked(reportsService.apAging).mockResolvedValue(REPORT);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Open Stone Co' }));
    expect(await screen.findByText('vendor page')).toBeInTheDocument();
  });

  it('says so when nothing is owed', async () => {
    vi.mocked(reportsService.apAging).mockResolvedValue({ ...REPORT, rows: [], totals: { bills: 0, buckets: [0, 0, 0, 0, 0], total: 0 } });
    renderPage();
    expect(await screen.findByText('No unpaid vendor bills.')).toBeInTheDocument();
  });
});
