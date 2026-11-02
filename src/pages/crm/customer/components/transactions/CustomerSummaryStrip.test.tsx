import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/customerTransactionsService', () => ({
  customerTransactionsService: { list: vi.fn(), summary: vi.fn() },
}));

import { CustomerSummaryStrip } from './CustomerSummaryStrip';
import { customerTransactionsService } from '@/services/customerTransactionsService';
import type { CustomerTransactionsOverview } from '@/types/customerTransactions';

const summary = vi.mocked(customerTransactionsService.summary);

function makeOverview(o: Partial<CustomerTransactionsOverview['summary']> = {}, scopeLimited = false): CustomerTransactionsOverview {
  return {
    scopeLimited,
    summary: {
      openBalance: 400, openInvoiceCount: 1, overdueBalance: 0, overdueInvoiceCount: 0,
      unappliedCredits: 50, billed12m: 9800, paid12m: 9400, lastActivityAt: '2026-10-02T09:00:00Z', ...o,
    },
    counts: [],
    types: [],
  };
}

function wrap(client: QueryClient, customerId: string) {
  return (
    <QueryClientProvider client={client}>
      <CustomerSummaryStrip customerId={customerId} />
    </QueryClientProvider>
  );
}

function renderStrip() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { client, ...render(wrap(client, 'c-1')) };
}

describe('CustomerSummaryStrip', () => {
  beforeEach(() => {
    summary.mockReset();
  });

  it('renders the summary tiles once loaded', async () => {
    summary.mockResolvedValue(makeOverview());
    renderStrip();
    expect(await screen.findByText('Open balance')).toBeInTheDocument();
    expect(screen.getByText('Paid (12 mo)')).toBeInTheDocument();
    expect(summary).toHaveBeenCalledWith('c-1');
  });

  it('hides tiles the caller cannot read and notes a limited scope', async () => {
    summary.mockResolvedValue(makeOverview({ openBalance: null, paid12m: null }, true));
    renderStrip();
    expect(await screen.findByText('Based on records you can see.')).toBeInTheDocument();
    expect(screen.queryByText('Open balance')).not.toBeInTheDocument();
  });

  it('renders nothing when the summary call fails', async () => {
    summary.mockRejectedValue(new AxiosError('boom'));
    const { container, client } = renderStrip();
    await waitFor(() => expect(client.getQueryState(['customer-transactions', 'c-1', 'summary'])?.status).toBe('error'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it('never coerces a null figure to zero', async () => {
    summary.mockResolvedValue(makeOverview({
      openBalance: null, overdueBalance: null, billed12m: null, unappliedCredits: null, paid12m: null, lastActivityAt: null,
    }));
    const { container, client } = renderStrip();
    await waitFor(() => expect(client.getQueryState(['customer-transactions', 'c-1', 'summary'])?.status).toBe('success'));
    expect(container).toBeEmptyDOMElement();
  });

  it('keys the cache by customer: switching customers never shows the previous customer figures', async () => {
    summary.mockImplementation(async (id: string) => (
      id === 'c-1' ? makeOverview({ openBalance: 111 }) : makeOverview({ openBalance: 222 })
    ));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(wrap(client, 'c-1'));
    expect(await screen.findByText(/111\.00/)).toBeInTheDocument();
    rerender(wrap(client, 'c-2'));
    expect(screen.queryByText(/111\.00/)).not.toBeInTheDocument();
    expect(await screen.findByText(/222\.00/)).toBeInTheDocument();
    expect(client.getQueryData(['customer-transactions', 'c-1', 'summary'])).toBeDefined();
    expect(client.getQueryData(['customer-transactions', 'c-2', 'summary'])).toBeDefined();
  });

  it('two strips for one customer share a single cache entry and fetch', async () => {
    summary.mockResolvedValue(makeOverview({ openBalance: 333 }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<>{wrap(client, 'c-1')}{wrap(client, 'c-1')}</>);
    expect(await screen.findAllByText(/333\.00/)).toHaveLength(2);
    expect(summary).toHaveBeenCalledTimes(1);
  });
});
