import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ProfitLoss } from '@/types/reports';

vi.mock('@/services/reportsService', () => ({ reportsService: { profitLoss: vi.fn(), accountLines: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../components/ReportTopBarChart', () => ({ ReportTopBarChart: () => null }));

import ProfitLossPage from './ProfitLossPage';
import { reportsService } from '@/services/reportsService';
import { formatMoney } from '@/lib/formatMoney';

const PL: ProfitLoss = {
  income: 1000, expenses: 400, grossProfit: 600, netProfit: 600, netMarginPercent: 60,
  sections: [
    { code: 4000, name: 'Revenue', kind: 'income', total: 1000, subcategories: [{ name: 'Sales', total: 1000, accounts: [{ id: 'acc-1', code: '4101', name: 'Product Sales', amount: 1000 }] }] },
    { code: 5000, name: 'Cost of Goods Sold', kind: 'expense', total: 400, subcategories: [{ name: 'COGS', total: 400, accounts: [{ id: 'acc-2', code: '5101', name: 'Purchases', amount: 400 }] }] },
  ],
};

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProfitLossPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProfitLossPage', () => {
  it('shows the statement with gross and net profit and the headline numbers', async () => {
    vi.mocked(reportsService.profitLoss).mockResolvedValue(PL);
    renderPage();
    const table = await screen.findByRole('table', { name: 'Profit and loss statement' });
    expect(within(table).getByText('Total Revenue')).toBeInTheDocument();
    expect(within(table).getByText('Gross profit')).toBeInTheDocument();
    expect(within(table).getByText('Net profit')).toBeInTheDocument();
    expect(screen.getByLabelText('Report totals')).toHaveTextContent(`Net profit${formatMoney(600)}`);
    const params = vi.mocked(reportsService.profitLoss).mock.calls[0][0];
    expect(Object.keys(params).sort()).toEqual(['from', 'to']);
  });

  it('opens the journal lines behind an account', async () => {
    vi.mocked(reportsService.profitLoss).mockResolvedValue(PL);
    vi.mocked(reportsService.accountLines).mockResolvedValue([
      { entryId: 'je-1', number: 'JE-000004', date: '2026-10-05', memo: 'Sale', sourceType: 'invoice', debit: 0, credit: 1000 },
    ]);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Show journal lines for 4101 · Product Sales' }));
    const link = await screen.findByRole('link', { name: 'Open journal entry JE-000004' });
    expect(link).toHaveAttribute('href', '/finance/journal-entries/je-1');
    expect(vi.mocked(reportsService.accountLines).mock.calls[0][0]).toBe('acc-1');
    await userEvent.click(screen.getByRole('button', { name: 'Close journal lines panel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says so when no journal entry touches an income or expense account', async () => {
    vi.mocked(reportsService.profitLoss).mockResolvedValue({ sections: [], income: 0, expenses: 0, grossProfit: 0, netProfit: 0, netMarginPercent: 0 });
    renderPage();
    expect(await screen.findByText(/No journal entries touch an income or expense account/)).toBeInTheDocument();
  });

  it('shows the server error and keeps exports disabled', async () => {
    vi.mocked(reportsService.profitLoss).mockRejectedValue(new Error('nope'));
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export Profit & Loss as PDF' })).toBeDisabled();
  });
});
