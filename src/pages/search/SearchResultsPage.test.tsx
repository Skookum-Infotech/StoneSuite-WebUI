import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
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

import SearchResultsPage from './SearchResultsPage';
import { globalSearchService } from '@/services/globalSearchService';

const mockSearch = vi.mocked(globalSearchService.search);

function renderAt(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/search" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<SearchResultsPage />, { wrapper });
}

beforeEach(() => vi.clearAllMocks());

describe('SearchResultsPage', () => {
  it('prompts for more characters when the query is too short', () => {
    renderAt('/search?q=a');
    expect(screen.getByText(/Type at least/i)).toBeInTheDocument();
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('renders a type rail with counts and lists the active group', async () => {
    mockSearch.mockResolvedValue({
      query: 'acme',
      groups: {
        customer: { results: [{ type: 'customer', id: 'c1', displayName: 'Acme Co', updatedAt: '2026-09-01T00:00:00Z', domain: 'crm', module: 'customer' }], hasMore: false },
        invoice: { results: [{ type: 'invoice', id: 'i1', displayName: 'Invoice INV-9', updatedAt: '2026-09-01T00:00:00Z', domain: 'sales', module: 'invoice' }], hasMore: false },
      },
    });

    renderAt('/search?q=acme');

    await waitFor(() => expect(screen.getByText('Acme Co')).toBeInTheDocument());
    expect(mockSearch).toHaveBeenCalledWith('acme', { limit: 50 });
    // both types appear in the rail
    expect(screen.getByRole('button', { name: /Customers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Invoices/i })).toBeInTheDocument();
  });

  it('honors ?type= to pick the active group', async () => {
    mockSearch.mockResolvedValue({
      query: 'acme',
      groups: {
        customer: { results: [{ type: 'customer', id: 'c1', displayName: 'Acme Co', updatedAt: '2026-09-01T00:00:00Z', domain: 'crm', module: 'customer' }], hasMore: false },
        invoice: { results: [{ type: 'invoice', id: 'i1', displayName: 'Invoice INV-9', updatedAt: '2026-09-01T00:00:00Z', domain: 'sales', module: 'invoice' }], hasMore: false },
      },
    });

    renderAt('/search?q=acme&type=invoice');
    await waitFor(() => expect(screen.getByText('Invoice INV-9')).toBeInTheDocument());
    expect(screen.queryByText('Acme Co')).not.toBeInTheDocument();
  });

  it('navigates to a hit on click', async () => {
    mockSearch.mockResolvedValue({
      query: 'acme',
      groups: {
        customer: { results: [{ type: 'customer', id: 'c1', displayName: 'Acme Co', updatedAt: '2026-09-01T00:00:00Z', domain: 'crm', module: 'customer' }], hasMore: false },
      },
    });

    const user = userEvent.setup();
    renderAt('/search?q=acme');
    await waitFor(() => expect(screen.getByText('Acme Co')).toBeInTheDocument());
    await user.click(screen.getByText('Acme Co'));
    expect(navigateSpy).toHaveBeenCalledWith('/crm/customer/c1');
  });

  it('shows an empty state when nothing matches', async () => {
    mockSearch.mockResolvedValue({ query: 'zzz', groups: {} });
    renderAt('/search?q=zzz');
    await waitFor(() => expect(screen.getByText(/No matches for/i)).toBeInTheDocument());
  });
});
