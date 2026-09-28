import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/chartOfAccountsService', () => ({
  chartOfAccountsService: { listAccounts: vi.fn(), searchAccounts: vi.fn() },
}));

import { AccountPicker } from './AccountPicker';
import { chartOfAccountsService } from '@/services/chartOfAccountsService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { Account, AccountType } from '@/types/chartOfAccounts';

// An account the picker can't list — inactive, hidden, a header, or of a type
// the field excludes — still exists, so it must never be offered for creation.

const account = (over: Partial<Account>): Account => ({
  id: 'acc-1', code: '1010', name: 'Operating Cash', isActive: true, isPostable: true, isVisible: true,
  ...over,
}) as Account;

const page = (records: Account[]) => ({ records, nextCursor: '', hasMore: false });

/** `listed` is what the picker's own list (postable + active) returns;
 *  `everything` is what the unfiltered existence lookup sees. */
function mockAccounts({ listed = [], everything = listed }: { listed?: Account[]; everything?: Account[] }) {
  vi.mocked(chartOfAccountsService.listAccounts).mockImplementation(async (filters = {}) =>
    page(filters.postable ? listed : everything));
  vi.mocked(chartOfAccountsService.searchAccounts).mockResolvedValue(page(listed));
}

function renderPicker({ canCreate = true, types }: { canCreate?: boolean; types?: AccountType[] } = {}) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => (resource === 'chart_of_account' && action === 'create' ? canCreate : true),
  } as ReturnType<typeof useUserPermissions>);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AccountPicker value={null} onChange={vi.fn()} options={{ types }} />
    </QueryClientProvider>,
  );
}

async function search(text: string) {
  const user = userEvent.setup();
  const input = screen.getByRole('textbox', { name: 'Search account' });
  await user.click(input);
  await user.type(input, text);
}

beforeEach(() => vi.clearAllMocks());

describe('AccountPicker — creating an account that is not there', () => {
  it('offers to create it in a new tab, prefilled with the typed name', async () => {
    mockAccounts({});
    renderPicker();
    await search('Petty Cash');

    const link = await screen.findByRole('link', { name: 'Create “Petty Cash” as a new account — opens in a new tab' });
    expect(link).toHaveAttribute('href', '/finance/chart-of-accounts?new=1&name=Petty+Cash');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it("carries the field's account type into the new account", async () => {
    mockAccounts({});
    renderPicker({ types: ['bank', 'cash'] });
    await search('Petty Cash');

    expect(await screen.findByRole('link', { name: /Create “Petty Cash”/ }))
      .toHaveAttribute('href', '/finance/chart-of-accounts?new=1&name=Petty+Cash&type=bank');
  });

  it('says who can add it when the user cannot create accounts', async () => {
    mockAccounts({});
    renderPicker({ canCreate: false });
    await search('Petty Cash');

    expect(await screen.findByText(/Ask someone with account access/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Create/ })).not.toBeInTheDocument();
  });

  it.each([
    ['an inactive account', { isActive: false }, 'Inactive'],
    ['a header account', { isPostable: false }, 'A header account — not postable'],
    ['a hidden account', { isVisible: false }, 'Hidden'],
  ])('does not offer create for %s of that name — it points at it instead', async (_label, over, reason) => {
    mockAccounts({ listed: [], everything: [account({ id: 'acc-9', code: '1090', name: 'Old Petty Cash', ...over })] });
    renderPicker();
    await search('old petty cash');

    expect(await screen.findByText(`An account named “1090 Old Petty Cash” already exists (${reason}).`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open “1090 Old Petty Cash” — opens in a new tab' }))
      .toHaveAttribute('href', '/finance/chart-of-accounts/acc-9');
    expect(screen.queryByRole('link', { name: /Create/ })).not.toBeInTheDocument();
  });

  it('treats an existing account code as taken too', async () => {
    mockAccounts({ listed: [], everything: [account({ id: 'acc-3', code: '1090', name: 'Old Petty Cash', isActive: false })] });
    renderPicker();
    await search('1090');

    expect(await screen.findByText(/already exists \(Inactive\)/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Create/ })).not.toBeInTheDocument();
  });

  it('shows nothing extra when the exact account is right there in the list', async () => {
    mockAccounts({ listed: [account({})] });
    renderPicker();
    await search('Operating Cash');

    expect(await screen.findByRole('button', { name: /Operating Cash/ })).toBeInTheDocument();
    expect(screen.queryByText(/isn't an existing account/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Create/ })).not.toBeInTheDocument();
  });
});
