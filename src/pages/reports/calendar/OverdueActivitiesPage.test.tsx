import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { OverdueActivity } from '@/types/reports';

vi.mock('@/services/reportsService', () => ({ reportsService: { overdueActivities: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../components/ReportCountBarChart', () => ({ ReportCountBarChart: () => null }));

import OverdueActivitiesPage from './OverdueActivitiesPage';
import { reportsService } from '@/services/reportsService';

const ROW: OverdueActivity = {
  orderId: 'ord-1', order: 'SORD-000001', customer: 'Acme', orderStatus: 'Open', code: 'template',
  activity: 'Template', scheduledAt: '2026-10-30T09:00:00Z', daysOverdue: 7,
};

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/reports/calendar/overdue']}>
        <Routes>
          <Route path="/reports/calendar/overdue" element={<OverdueActivitiesPage />} />
          <Route path="/sales/sales_order/:id" element={<p>order page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OverdueActivitiesPage', () => {
  it('shows how long each activity is overdue and summarises them', async () => {
    vi.mocked(reportsService.overdueActivities).mockResolvedValue({
      totals: { activities: 1, orders: 1, oldestDays: 7, byActivity: [{ code: 'template', activity: 'Template', count: 1 }] },
      rows: [ROW],
    });
    renderPage();
    expect(await screen.findByRole('table', { name: 'Overdue activities' })).toHaveTextContent('7 days');
    expect(screen.getByLabelText('Report totals')).toHaveTextContent('Overdue activities1');
  });

  it('opens the order when a row is chosen', async () => {
    vi.mocked(reportsService.overdueActivities).mockResolvedValue({
      totals: { activities: 1, orders: 1, oldestDays: 7, byActivity: [] },
      rows: [ROW],
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Open SORD-000001' }));
    expect(await screen.findByText('order page')).toBeInTheDocument();
  });

  it('shows a positive message when nothing is overdue', async () => {
    vi.mocked(reportsService.overdueActivities).mockResolvedValue({
      totals: { activities: 0, orders: 0, oldestDays: 0, byActivity: [] },
      rows: [],
    });
    renderPage();
    expect(await screen.findByText(/Nothing is overdue/)).toBeInTheDocument();
  });
});
