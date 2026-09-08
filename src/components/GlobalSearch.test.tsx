import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import type * as GlobalSearchServiceModule from '@/services/globalSearchService';
import type * as ReactRouterModule from 'react-router-dom';

vi.mock('@/services/globalSearchService', async (importOriginal) => {
  const actual = await importOriginal<typeof GlobalSearchServiceModule>();
  return { ...actual, globalSearchService: { search: vi.fn() } };
});

const navigateSpy = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouterModule>();
  return { ...actual, useNavigate: () => navigateSpy };
});

import { GlobalSearch } from './GlobalSearch';
import { globalSearchService } from '@/services/globalSearchService';

const mockSearch = vi.mocked(globalSearchService.search);

function renderSearch() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<GlobalSearch />, { wrapper });
}

beforeEach(() => vi.clearAllMocks());

describe('GlobalSearch', () => {
  it('groups results by entity type and shows a curated label', async () => {
    mockSearch.mockResolvedValue({
      query: 'ac',
      groups: {
        customer: { results: [{ type: 'customer', id: 'c1', number: 'CUST-1', displayName: 'Acme Co', updatedAt: '2026-09-01T00:00:00Z', domain: 'crm', module: 'customer' }], hasMore: false },
        invoice: { results: [{ type: 'invoice', id: 'i1', number: 'INV-9', displayName: 'Invoice INV-9', subtitle: 'Acme Co', updatedAt: '2026-09-01T00:00:00Z', domain: 'sales', module: 'invoice' }], hasMore: true },
      },
    });

    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByRole('combobox'), 'ac');

    await waitFor(() => expect(screen.getByText('Acme Co')).toBeInTheDocument());
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
    // hasMore group gets a "See all" affordance
    expect(screen.getByRole('option', { name: /See all Invoices/i })).toBeInTheDocument();
    // and a global "see everything" row
    expect(screen.getByRole('option', { name: /See all results for/i })).toBeInTheDocument();
  });

  it('navigates to the resolved route when a hit is clicked', async () => {
    mockSearch.mockResolvedValue({
      query: 'job',
      groups: {
        fabrication_job: { results: [{ type: 'fabrication_job', id: 'j1', number: 'FJOB-1', displayName: 'Job FJOB-1', updatedAt: '2026-09-01T00:00:00Z', domain: 'sales', module: 'installation' }], hasMore: false },
      },
    });

    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByRole('combobox'), 'job');
    await waitFor(() => expect(screen.getByText('Job FJOB-1')).toBeInTheDocument());

    await user.click(screen.getByText('Job FJOB-1'));
    expect(navigateSpy).toHaveBeenCalledWith('/sales/installation/j1');
  });

  it('arrow keys walk a flat index across groups and Enter navigates the active row', async () => {
    mockSearch.mockResolvedValue({
      query: 'ac',
      groups: {
        customer: { results: [{ type: 'customer', id: 'c1', displayName: 'Acme Co', updatedAt: '2026-09-01T00:00:00Z', domain: 'crm', module: 'customer' }], hasMore: false },
        invoice: { results: [{ type: 'invoice', id: 'i1', displayName: 'Invoice INV-9', updatedAt: '2026-09-01T00:00:00Z', domain: 'sales', module: 'invoice' }], hasMore: false },
      },
    });

    const user = userEvent.setup();
    renderSearch();
    const input = screen.getByRole('combobox');
    await user.type(input, 'ac');
    await waitFor(() => expect(screen.getByText('Acme Co')).toBeInTheDocument());

    // index 0 = Acme (customer), 1 = Invoice INV-9, 2 = "See all results"
    await user.keyboard('{ArrowDown}{Enter}');
    expect(navigateSpy).toHaveBeenCalledWith('/sales/invoice/i1');
  });

  it('does not query below the minimum term length', async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByRole('combobox'), 'a');
    await new Promise((r) => setTimeout(r, 350));
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('shows an empty state when nothing matches', async () => {
    mockSearch.mockResolvedValue({ query: 'zzz', groups: {} });
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByRole('combobox'), 'zzz');
    await waitFor(() => expect(screen.getByText(/No matches for/i)).toBeInTheDocument());
  });
});
