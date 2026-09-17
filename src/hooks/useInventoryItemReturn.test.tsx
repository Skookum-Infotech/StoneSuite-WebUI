import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, Link, RouterProvider, useNavigate, useSearchParams } from 'react-router-dom';

vi.mock('@/services/inventoryService', () => ({
  inventoryService: { searchItems: vi.fn() },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { InventoryItemReturnContext, useInventoryItemReturn } from './useInventoryItemReturn';
import { useUserPermissions } from './useUserPermissions';
import { inventoryService } from '@/services/inventoryService';
import { QuoteItemsTab } from '@/pages/sales/components/QuoteItemsTab';
import { readReturnStash, returnRouterState, writeReturnStash } from '@/lib/inventoryItemReturn';
import type { QuoteLineItem } from '@/lib/quoteForm';
import type { InventoryItem } from '@/types/inventory';

const CREATED = {
  id: 'item-new', name: 'Nero Marquina Polished', sku: 'NM-01', description: 'Black marble', unitPrice: 80,
} as InventoryItem;
const DOC_PATH = '/sales/quote/new';
// Each flow crosses two routes and waits out the picker's search debounce
// several times — comfortably fast alone, but past the 5s default when the
// whole suite runs in parallel.
const ROUND_TRIP_TIMEOUT_MS = 15_000;

// A stand-in document page wired exactly like the real Add/Edit pages: seeds
// its state from `restored` and provides the context around its items table.
function DocumentPage() {
  const inventoryReturn = useInventoryItemReturn<{ notes: string; lineItems: QuoteLineItem[] }>();
  const [notes, setNotes] = useState(inventoryReturn.restored?.notes ?? '');
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>(inventoryReturn.restored?.lineItems ?? []);
  return (
    <InventoryItemReturnContext.Provider value={inventoryReturn.provide({ notes, lineItems })}>
      <input aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <QuoteItemsTab items={lineItems} onUpdate={setLineItems} headerTaxPercent={0} />
    </InventoryItemReturnContext.Provider>
  );
}

// Stand-in for Inventory → New Item, following AddItemPage's return contract.
function NewItemPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = params.get('returnTo') ?? '/';
  return (
    <div>
      <p>New item named {params.get('name')}</p>
      <button type="button" onClick={() => navigate(returnTo, { state: returnRouterState(CREATED) })}>Save Item</button>
      <button type="button" onClick={() => navigate(returnTo, { state: returnRouterState(null) })}>Cancel Item</button>
    </div>
  );
}

function renderApp(initialPath = DOC_PATH) {
  const router = createMemoryRouter(
    [
      { path: DOC_PATH, element: <DocumentPage /> },
      { path: '/inventory/item/new', element: <NewItemPage /> },
      { path: '/elsewhere', element: <Link to={DOC_PATH}>Open quote</Link> },
    ],
    { initialEntries: [initialPath] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function mockCanCreateItems(allowed: boolean) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '',
    hasPermission: (resource: string, action: string) => allowed && resource === 'inventory_item' && action === 'create',
  } as ReturnType<typeof useUserPermissions>);
}

async function startLineAndLeaveForInventory(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Notes'), 'Rush job');
  await user.click(screen.getByRole('button', { name: 'Add Line' }));
  await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'Nero Marquina');
  await user.click(await screen.findByRole('option', { name: 'Add “Nero Marquina” to Inventory' }));
  expect(await screen.findByText('New item named Nero Marquina')).toBeInTheDocument();
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockCanCreateItems(true);
  vi.mocked(inventoryService.searchItems).mockImplementation(async ({ search }) => ({
    records: search === CREATED.name ? [CREATED] : [],
    nextCursor: '',
    hasMore: false,
  }));
});

describe('Add to Inventory round trip', { timeout: ROUND_TRIP_TIMEOUT_MS }, () => {
  it('returns to the document with its unsaved work and the new item on the line', async () => {
    const user = userEvent.setup({ delay: null });
    renderApp();

    await startLineAndLeaveForInventory(user);
    await user.click(screen.getByRole('button', { name: 'Save Item' }));

    expect(await screen.findByLabelText('Notes')).toHaveValue('Rush job');
    expect(screen.getByRole('combobox', { name: 'Item Name' })).toHaveValue(CREATED.name);

    await user.click(screen.getByRole('button', { name: 'Save Line' }));
    expect(screen.getByRole('cell', { name: CREATED.name })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(readReturnStash()).toBeNull();
  });

  it('keeps the typed row after cancelling, and still refuses to save it without an item', async () => {
    const user = userEvent.setup({ delay: null });
    renderApp();

    await startLineAndLeaveForInventory(user);
    await user.click(screen.getByRole('button', { name: 'Cancel Item' }));

    expect(await screen.findByLabelText('Notes')).toHaveValue('Rush job');
    expect(screen.getByRole('combobox', { name: 'Item Name' })).toHaveValue('Nero Marquina');

    await user.click(screen.getByRole('button', { name: 'Save Line' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Select an item from inventory before saving this line.');
  });

  it('does not resurrect an old stash on a fresh visit to the same page', async () => {
    writeReturnStash({ returnTo: DOC_PATH, page: { notes: 'Stale', lineItems: [] }, line: null });
    const user = userEvent.setup({ delay: null });
    renderApp('/elsewhere');

    await user.click(screen.getByRole('link', { name: 'Open quote' }));

    expect(await screen.findByLabelText('Notes')).toHaveValue('');
    expect(readReturnStash()).toBeNull();
  });

  it('only warns, with no way to leave, when the user cannot create inventory items', async () => {
    mockCanCreateItems(false);
    const user = userEvent.setup({ delay: null });
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Add Line' }));
    await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'Nero Marquina');

    expect(await screen.findByText(/“Nero Marquina” isn't in inventory/)).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /to Inventory/ })).not.toBeInTheDocument();
  });
});
