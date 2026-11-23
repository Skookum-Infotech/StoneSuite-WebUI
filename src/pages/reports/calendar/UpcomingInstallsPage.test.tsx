import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { UpcomingInstallsReport } from '@/types/reports';

vi.mock('@/services/reportsService', () => ({ reportsService: { upcomingInstalls: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../components/ReportCountBarChart', () => ({ ReportCountBarChart: () => null }));

import UpcomingInstallsPage from './UpcomingInstallsPage';
import { reportsService } from '@/services/reportsService';

const REPORT: UpcomingInstallsReport = {
  weeks: 8,
  perWeek: [{ weekStart: '2026-11-09', count: 2 }],
  rows: [
    { orderId: 'a', order: 'SORD-1', customer: 'Acme', day: '2026-11-10', weekStart: '2026-11-09', source: 'plan', lead: '' },
    { orderId: 'b', order: 'SORD-2', customer: 'Beta', day: '2026-11-12', weekStart: '2026-11-09', source: 'appointment', lead: 'Sam Crew' },
  ],
};

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <UpcomingInstallsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UpcomingInstallsPage', () => {
  it('asks for 8 weeks first and splits booked visits from planned dates', async () => {
    vi.mocked(reportsService.upcomingInstalls).mockResolvedValue(REPORT);
    renderPage();
    const table = await screen.findByRole('table', { name: 'Upcoming installs' });
    expect(reportsService.upcomingInstalls).toHaveBeenCalledWith(8);
    expect(table).toHaveTextContent('Booked visit');
    expect(table).toHaveTextContent('Planned date');
    expect(table).toHaveTextContent('Sam Crew');
    const kpis = screen.getByLabelText('Report totals');
    expect(kpis).toHaveTextContent('Booked visits1');
    expect(kpis).toHaveTextContent('Planned only1');
  });

  it('refetches with the chosen look-ahead', async () => {
    vi.mocked(reportsService.upcomingInstalls).mockResolvedValue(REPORT);
    renderPage();
    await screen.findByRole('table', { name: 'Upcoming installs' });
    await userEvent.click(screen.getByRole('button', { name: 'Look ahead: 12 weeks' }));
    await waitFor(() => expect(reportsService.upcomingInstalls).toHaveBeenLastCalledWith(12));
  });

  it('says so when no installs are scheduled', async () => {
    vi.mocked(reportsService.upcomingInstalls).mockResolvedValue({ weeks: 8, perWeek: [], rows: [] });
    renderPage();
    expect(await screen.findByText('No installs are scheduled in this period.')).toBeInTheDocument();
  });
});
