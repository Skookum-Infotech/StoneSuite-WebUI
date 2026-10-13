import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';

vi.mock('@/services/inventoryService', () => ({
  inventoryService: { searchItems: vi.fn(), searchKits: vi.fn() },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import ItemListPage from './ItemListPage';
import { inventoryService } from '@/services/inventoryService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { InventoryItem, InventoryKit } from '@/types/inventory';

const SLAB = {
  id: 'i1', sku: 'GRAN-01', name: 'Absolute Black', description: '', unitId: 1, unitPrice: 50, isActive: true,
  customFields: {}, tracking: 'quantity', thicknessMm: 0, barcode: '', createdAt: '', updatedAt: '',
} as InventoryItem;

function kit(id: string, name: string, over: Partial<InventoryKit> = {}): InventoryKit {
  return { id, name, description: '', isActive: true, itemCount: 2, createdAt: '', updatedAt: '', ...over };
}

function mockPermissions(allowed: string[]) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => allowed.includes(`${resource}:${action}`),
  } as ReturnType<typeof useUserPermissions>);
}

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname}{search}</p>;
}

function renderList(initialPath = '/inventory/item') {
  const router = createMemoryRouter(
    [
      { path: '/inventory/item', element: <><ItemListPage /><Where /></> },
      { path: '/inventory/item/new', element: <><p>New item page</p><Where /></> },
      { path: '/inventory/kit/new', element: <><p>New kit page</p><Where /></> },
      { path: '/inventory/kit/:id', element: <><p>Edit kit page</p><Where /></> },
    ],
    { initialEntries: [initialPath] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPermissions(['inventory_item:read', 'inventory_item:create', 'inventory_item:update']);
  vi.mocked(inventoryService.searchItems).mockResolvedValue({ records: [SLAB], nextCursor: '', hasMore: false });
  vi.mocked(inventoryService.searchKits).mockResolvedValue({
    records: [kit('k1', 'Kitchen', { itemCount: 4, description: 'Counters and splash' }), kit('k2', 'Bathroom', { isActive: false })],
    nextCursor: '', hasMore: false,
  });
});

describe('Inventory Items page — Kits tab', () => {
  it('opens on Items, with a New Kit/Package button beside New Item', async () => {
    renderList();

    expect(await screen.findByText('Absolute Black')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Items' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'New Kit/Package' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Item' })).toBeInTheDocument();
    expect(inventoryService.searchKits).not.toHaveBeenCalled();
  });

  it('switches to the Kits tab, keeps it in the address, and lists the kits with their counts', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Absolute Black');

    await user.click(screen.getByRole('tab', { name: 'Kit/Packages' }));

    expect(await screen.findByText('Kitchen')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/inventory/item?tab=kits');
    const row = screen.getByText('Kitchen').closest('tr') as HTMLElement;
    expect(within(row).getByText('4')).toBeInTheDocument();
    expect(within(row).getByText('Counters and splash')).toBeInTheDocument();
    expect(within(row).getByText('Active')).toBeInTheDocument();
    const retired = screen.getByText('Bathroom').closest('tr') as HTMLElement;
    expect(within(retired).getByText('Inactive')).toBeInTheDocument();
    expect(screen.queryByText('Absolute Black')).not.toBeInTheDocument();
  });

  it('opens straight on the Kits tab from the address', async () => {
    renderList('/inventory/item?tab=kits');

    expect(await screen.findByText('Kitchen')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Kit/Packages' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens a kit on click, and New Kit/Package goes to the new-kit page', async () => {
    const user = userEvent.setup();
    const router = renderList('/inventory/item?tab=kits');

    await user.click(await screen.findByRole('button', { name: 'Kitchen' }));
    expect(await screen.findByText('Edit kit page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/inventory/kit/k1');

    await router.navigate('/inventory/item?tab=kits');
    await user.click(await screen.findByRole('button', { name: 'New Kit/Package' }));
    expect(await screen.findByText('New kit page')).toBeInTheDocument();
  });

  it('searches kits by name', async () => {
    const user = userEvent.setup();
    renderList('/inventory/item?tab=kits');
    await screen.findByText('Kitchen');

    await user.type(screen.getByRole('textbox', { name: 'Search kit/packages' }), 'Kit');

    await vi.waitFor(() => expect(inventoryService.searchKits).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'Kit', sort: [{ field: 'name', dir: 'asc' }] }),
    ));
  });

  it('says so when there are no kits', async () => {
    vi.mocked(inventoryService.searchKits).mockResolvedValue({ records: [], nextCursor: '', hasMore: false });
    renderList('/inventory/item?tab=kits');

    expect(await screen.findByText('No kit/packages added yet.')).toBeInTheDocument();
  });

  it('hides the create buttons and the row actions from a read-only user', async () => {
    mockPermissions(['inventory_item:read']);
    renderList('/inventory/item?tab=kits');

    expect(await screen.findByText('Kitchen')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Kit/Package' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Item' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit kit/package Kitchen' })).not.toBeInTheDocument();
  });
});
