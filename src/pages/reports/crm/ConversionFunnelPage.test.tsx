import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { CrmFunnel } from '@/types/reports';

vi.mock('@/services/reportsService', () => ({ reportsService: { crmFunnel: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../components/ReportCountBarChart', () => ({ ReportCountBarChart: () => null }));

import ConversionFunnelPage from './ConversionFunnelPage';
import { reportsService } from '@/services/reportsService';

const FUNNEL: CrmFunnel = {
  unqualified: 3,
  stages: [
    { key: 'leads', label: 'Leads created', count: 20, percentOfLeads: 100, percentOfPrevious: 100, avgDaysFromLead: null },
    { key: 'qualified', label: 'Qualified', count: 10, percentOfLeads: 50, percentOfPrevious: 50, avgDaysFromLead: null },
    { key: 'prospects', label: 'Became prospects', count: 5, percentOfLeads: 25, percentOfPrevious: 50, avgDaysFromLead: 4 },
    { key: 'customers', label: 'Became customers', count: 2, percentOfLeads: 10, percentOfPrevious: 40, avgDaysFromLead: 12.5 },
  ],
};

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ConversionFunnelPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ConversionFunnelPage', () => {
  it('sends only the lead-creation window and shows the headline numbers', async () => {
    vi.mocked(reportsService.crmFunnel).mockResolvedValue(FUNNEL);
    renderPage();
    expect(await screen.findByRole('table', { name: 'Conversion funnel' })).toBeInTheDocument();
    const params = vi.mocked(reportsService.crmFunnel).mock.calls[0][0];
    expect(Object.keys(params).sort()).toEqual(['from', 'to']);
    const kpis = screen.getByLabelText('Report totals');
    expect(kpis).toHaveTextContent('Leads created20');
    expect(kpis).toHaveTextContent('Lead to customer10.0%');
    expect(kpis).toHaveTextContent('Avg days to customer12.5');
    expect(kpis).toHaveTextContent('Unqualified3');
  });

  it('shows the server error', async () => {
    vi.mocked(reportsService.crmFunnel).mockRejectedValue(new Error('nope'));
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
