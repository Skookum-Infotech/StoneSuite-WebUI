import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/inventoryService', () => ({ inventoryService: { searchItems: vi.fn() } }));

import { ItemPicker } from './ItemPicker';
import { inventoryService } from '@/services/inventoryService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { InventoryItem, InventoryItemSearchRequest } from '@/types/inventory';

// A name the picker can't list must lead to "create it" only when it truly
// isn't in the system — an Inactive item, or one a field's filter hides, is
// still an existing item, and a duplicate must never be offered.

const SERIALIZED_ONLY = [{ field: 'tracking', op: 'eq' as const, value: 'serialized' }];

const item = (over: Partial<InventoryItem>): InventoryItem => ({
  id: 'it-1', sku: 'NER-M', name: 'Nero Marquina', isActive: true, tracking: 'quantity',
  ...over,
}) as InventoryItem;

// The picker lists a short page; the "does it already exist?" lookup reads a
// longer one, unfiltered — that is how the two calls are told apart here.
const LIST_PAGE_SIZE = 8;

/** `listed` is what the picker's own list search returns; `everything` is what
 *  the unfiltered all-status existence lookup sees (an Inactive item, or one a
 *  field's `filters` hides, appears only there). */
function mockCatalog({ listed = [], everything = listed }: { listed?: InventoryItem[]; everything?: InventoryItem[] }) {
  vi.mocked(inventoryService.searchItems).mockImplementation(async (req: InventoryItemSearchRequest) => ({
    records: (req.limit ?? 0) > LIST_PAGE_SIZE ? everything : listed,
    nextCursor: '',
    hasMore: false,
  }));
}

function renderPicker({ canCreate = true, filters }: { canCreate?: boolean; filters?: typeof SERIALIZED_ONLY } = {}) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => (resource === 'inventory_item' && action === 'create' ? canCreate : true),
  } as ReturnType<typeof useUserPermissions>);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ItemPicker value={null} onChange={vi.fn()} filters={filters} />
    </QueryClientProvider>,
  );
}

async function search(text: string) {
  const user = userEvent.setup();
  const input = screen.getByRole('textbox', { name: 'Search inventory item' });
  await user.click(input);
  await user.type(input, text);
}

beforeEach(() => vi.clearAllMocks());

describe('ItemPicker — creating an item that is not there', () => {
  it('offers to create it in a new tab, prefilled with the typed name', async () => {
    mockCatalog({});
    renderPicker();
    await search('Calacatta Gold');

    const link = await screen.findByRole('link', { name: 'Create “Calacatta Gold” as a new item — opens in a new tab' });
    expect(link).toHaveAttribute('href', '/inventory/item/new?name=Calacatta+Gold');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('says who can add it when the user cannot create items', async () => {
    mockCatalog({});
    renderPicker({ canCreate: false });
    await search('Calacatta Gold');

    expect(await screen.findByText(/Ask someone with item access/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Create/ })).not.toBeInTheDocument();
  });

  it('does not offer create for an Inactive item of that name — it points at it instead', async () => {
    mockCatalog({ listed: [], everything: [item({ id: 'it-9', isActive: false })] });
    renderPicker();
    await search('nero marquina');

    expect(await screen.findByText('An item named “Nero Marquina” already exists (Inactive).')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open “Nero Marquina” — opens in a new tab' })).toHaveAttribute('href', '/inventory/item/it-9');
    expect(screen.queryByRole('link', { name: /Create/ })).not.toBeInTheDocument();
  });

  it('does not offer create for an item this field filters out, and says why', async () => {
    mockCatalog({ listed: [], everything: [item({ id: 'it-5', isActive: true })] });
    renderPicker({ filters: SERIALIZED_ONLY });
    await search('Nero Marquina');

    expect(await screen.findByText(/already exists \(Active, but not available for this field\)/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Create/ })).not.toBeInTheDocument();
  });

  it('treats an existing SKU as taken too', async () => {
    mockCatalog({ listed: [], everything: [item({ id: 'it-7', isActive: false, sku: 'NER-M' })] });
    renderPicker();
    await search('ner-m');

    expect(await screen.findByText(/already exists \(Inactive\)/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Create/ })).not.toBeInTheDocument();
  });

  it('shows nothing extra when the exact item is right there in the list', async () => {
    mockCatalog({ listed: [item({})] });
    renderPicker();
    await search('Nero Marquina');

    expect(await screen.findByRole('button', { name: /Nero Marquina/ })).toBeInTheDocument();
    expect(screen.queryByText(/isn't an existing item/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Create/ })).not.toBeInTheDocument();
    // The existence lookup is skipped when the list already answers the question.
    expect(inventoryService.searchItems).toHaveBeenCalledTimes(1);
  });

  it('still offers create beside partial matches when nothing matches exactly', async () => {
    mockCatalog({ listed: [item({ id: 'it-2', name: 'Nero Marquina Honed', sku: 'NER-H' })] });
    renderPicker();
    await search('Nero Marquina Polished');

    expect(await screen.findByRole('link', { name: /Create “Nero Marquina Polished” as a new item/ })).toBeInTheDocument();
  });
});
