import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { CrmStaleReport } from '@/types/reports';

vi.mock('@/services/reportsService', () => ({ reportsService: { crmStale: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import StaleRecordsPage from './StaleRecordsPage';
import { reportsService } from '@/services/reportsService';

const REPORT: CrmStaleReport = {
  days: 14,
  rows: [
    { id: 'lead-1', stage: 'lead', name: 'Old Lead Co', status: 'New', owner: 'Sam Rep', lastTouch: '2026-09-01T00:00:00Z', daysIdle: 66 },
    { id: 'pros-1', stage: 'prospect', name: 'Quiet Prospect', status: 'Contacted', owner: '', lastTouch: '2026-10-01T00:00:00Z', daysIdle: 36 },
  ],
};

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/reports/crm/stale']}>
        <Routes>
          <Route path="/reports/crm/stale" element={<StaleRecordsPage />} />
          <Route path="/crm/:stage/:id" element={<p>record page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StaleRecordsPage', () => {
  it('asks for 14 idle days first and summarises what it found', async () => {
    vi.mocked(reportsService.crmStale).mockResolvedValue(REPORT);
    renderPage();
    expect(await screen.findByRole('button', { name: 'Open Old Lead Co' })).toBeInTheDocument();
    expect(reportsService.crmStale).toHaveBeenCalledWith(14);
    expect(screen.getByLabelText('Report totals')).toHaveTextContent('Stale records2');
  });

  it('refetches with the chosen idle threshold', async () => {
    vi.mocked(reportsService.crmStale).mockResolvedValue(REPORT);
    renderPage();
    await screen.findByText('Old Lead Co');
    await userEvent.click(screen.getByRole('button', { name: 'Idle for: 30+ days' }));
    await waitFor(() => expect(reportsService.crmStale).toHaveBeenLastCalledWith(30));
  });

  it('opens the record in its own stage when a row is chosen', async () => {
    vi.mocked(reportsService.crmStale).mockResolvedValue(REPORT);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Open Quiet Prospect' }));
    expect(await screen.findByText('record page')).toBeInTheDocument();
  });

  it('shows the empty message when nothing is stale', async () => {
    vi.mocked(reportsService.crmStale).mockResolvedValue({ days: 14, rows: [] });
    renderPage();
    expect(await screen.findByText(/Nothing is stale/)).toBeInTheDocument();
  });
});
