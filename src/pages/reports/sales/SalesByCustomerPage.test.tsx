import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { SalesCustomerRow, SalesReport } from '@/types/reports';

vi.mock('@/services/reportsService', () => ({
  reportsService: { salesByCustomer: vi.fn(), salesRecords: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// Recharts needs real layout; the chart is covered by its own data, not by jsdom.
vi.mock('../components/ReportTopBarChart', () => ({ ReportTopBarChart: () => null }));

import SalesByCustomerPage from './SalesByCustomerPage';
import { reportsService } from '@/services/reportsService';
import { formatMoney } from '@/lib/formatMoney';

const ROW: SalesCustomerRow = {
  customerId: '0b2f6f6e-8c1d-4e0a-9f3b-1a2b3c4d5e6f',
  name: 'Acme Stoneworks',
  records: 3,
  revenue: 1200,
  cost: 700,
  margin: 500,
  avgValue: 400,
  lastDate: '2026-10-05T00:00:00Z',
};

function report(rows: SalesCustomerRow[]): SalesReport<SalesCustomerRow> {
  return {
    basis: 'invoices',
    totals: { revenue: 1200, cost: 700, margin: 500, marginPercent: 41.7, records: 3 },
    rows,
  };
}

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SalesByCustomerPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SalesByCustomerPage', () => {
  it('asks for invoices year-to-date first and shows the rows and totals', async () => {
    vi.mocked(reportsService.salesByCustomer).mockResolvedValue(report([ROW]));
    renderPage();
    expect(await screen.findByRole('button', { name: 'Show records for Acme Stoneworks' })).toBeInTheDocument();
    const params = vi.mocked(reportsService.salesByCustomer).mock.calls[0][0];
    expect(params.basis).toBe('invoices');
    expect(params.from).toMatch(/^\d{4}-01-01$/);
    expect(params.bucket).toBeUndefined();
    expect(screen.getByLabelText('Report totals')).toHaveTextContent(formatMoney(1200));
  });

  it('refetches on the other basis when the toggle is used', async () => {
    vi.mocked(reportsService.salesByCustomer).mockResolvedValue(report([ROW]));
    renderPage();
    await screen.findByText('Acme Stoneworks');
    await userEvent.click(screen.getByRole('button', { name: 'Based on: Sales orders' }));
    await waitFor(() =>
      expect(vi.mocked(reportsService.salesByCustomer).mock.calls.at(-1)?.[0].basis).toBe('orders'),
    );
  });

  it('opens the drill-down panel for the clicked customer and closes it again', async () => {
    vi.mocked(reportsService.salesByCustomer).mockResolvedValue(report([ROW]));
    vi.mocked(reportsService.salesRecords).mockResolvedValue({
      basis: 'invoices',
      path: '/sales/invoice',
      records: [{ id: 'inv-1', number: 'INV-000007', date: '2026-10-05', customer: 'Acme Stoneworks', status: 'Sent', revenue: 400 }],
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Show records for Acme Stoneworks' }));

    const link = await screen.findByRole('link', { name: 'Open INV-000007' });
    expect(link).toHaveAttribute('href', '/sales/invoice/inv-1');
    expect(vi.mocked(reportsService.salesRecords).mock.calls[0][1]).toEqual({ customerId: ROW.customerId });

    await userEvent.click(screen.getByRole('button', { name: 'Close records panel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the empty message when no sales fall in the window', async () => {
    vi.mocked(reportsService.salesByCustomer).mockResolvedValue(report([]));
    renderPage();
    expect(await screen.findByText('No records in this period.')).toBeInTheDocument();
  });

  it('shows the server error and keeps exports disabled', async () => {
    vi.mocked(reportsService.salesByCustomer).mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Sales by Customer as CSV' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Export Sales by Customer as PDF' })).toBeDisabled();
  });
});
