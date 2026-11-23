import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-router-dom', async () => ({
  useNavigate: () => vi.fn(),
  Link: (await import('@/test/routerLinkStub')).RouterLinkStub,
  useSearchParams: (await import('@/test/routerSearchParamsStub')).useSearchParams,
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/invoiceService', () => ({
  invoiceService: { searchInvoices: vi.fn(), transition: vi.fn() },
}));

import { InvoiceTable } from './InvoiceTable';
import { invoiceService } from '@/services/invoiceService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAuthStore } from '@/store/useAuthStore';
import { INVOICE_VIEWS_PAGE } from '@/lib/invoiceSavedViews';
import { savedViewsKey } from '@/lib/savedViews';
import type { UserProfile } from '@/types/auth';

// Each test renders a table and clicks through it. A busy CI shard has stalled
// such tests past Vitest's default 5s limit, which was also the length of every
// wait below, so the test timed out before a wait could say what it was waiting
// for. Give the file room and keep each wait shorter than the test.
vi.setConfig({ testTimeout: 20_000 });
const SETTLE = { timeout: 10_000 };
const SEARCH_PLACEHOLDER = 'Search invoice #, customer, PO…';
const key = savedViewsKey(INVOICE_VIEWS_PAGE, 'user-1', 'tenant-1');

function lastRequest() {
  return vi.mocked(invoiceService.searchInvoices).mock.calls.at(-1)?.[0];
}

function mountTable() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><InvoiceTable /></QueryClientProvider>);
}

describe('InvoiceTable saved views', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useAuthStore.setState({
      user: { id: 'user-1', email: 'u@example.com', fullName: 'User One' } as UserProfile,
      activeTenantId: 'tenant-1',
    });
    vi.mocked(invoiceService.searchInvoices).mockResolvedValue({ records: [], nextCursor: '', hasMore: false, scope: 'all' });
    vi.mocked(useUserPermissions).mockReturnValue({
      grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false, hasPermission: () => true,
    } as ReturnType<typeof useUserPermissions>);
  });

  it('reapplies exactly the same search and sort after a reload, and deletes the view', async () => {
    const user = userEvent.setup();
    const first = mountTable();
    await screen.findByText('No invoices added yet.', {}, SETTLE);

    // Set up a screen worth keeping: a search, sorted by balance due.
    await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), 'overdue');
    await user.click(screen.getByRole('button', { name: /^Balance Due/ }));
    await waitFor(() => expect(lastRequest()).toMatchObject({
      search: 'overdue', sort: [{ field: 'balance_due', dir: 'desc' }],
    }), SETTLE);

    await user.click(screen.getByRole('button', { name: 'Save view' }));
    await user.type(screen.getByRole('textbox', { name: 'View name' }), 'Overdue by balance');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('combobox', { name: 'Apply a saved view' })).toHaveTextContent('Overdue by balance');
    first.unmount();

    // A reload: a brand-new table, back at its defaults, with the view still there.
    mountTable();
    await screen.findByText('No invoices added yet.', {}, SETTLE);
    expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toHaveValue('');
    expect(lastRequest()).toMatchObject({ sort: [{ field: 'created_at', dir: 'desc' }] });

    await user.click(screen.getByRole('combobox', { name: 'Apply a saved view' }));
    await user.click(await screen.findByRole('option', { name: 'Overdue by balance' }));

    expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toHaveValue('overdue');
    await waitFor(() => expect(lastRequest()).toMatchObject({
      search: 'overdue', sort: [{ field: 'balance_due', dir: 'desc' }], cursor: undefined,
    }), SETTLE);
    expect(screen.getByRole('combobox', { name: 'Apply a saved view' })).toHaveTextContent('Overdue by balance');

    // Deleting it works, and it stays gone.
    await user.click(screen.getByRole('button', { name: 'Delete saved view Overdue by balance' }));
    expect(screen.queryByRole('combobox', { name: 'Apply a saved view' })).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(key) ?? 'null')).toEqual([]);
  });

  it('still works as a list when the stored views are corrupt', async () => {
    window.localStorage.setItem(key, '[[[ definitely not views');
    mountTable();
    expect(await screen.findByText('No invoices added yet.', {}, SETTLE)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Apply a saved view' })).toBeNull();
  });

  it('still works as a list when browser storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    mountTable();
    expect(await screen.findByText('No invoices added yet.', {}, SETTLE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save view' })).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
