import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';

vi.mock('@/services/inventoryService', () => ({
  inventoryService: { getKit: vi.fn(), updateKit: vi.fn(), deleteKit: vi.fn(), searchItems: vi.fn() },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import EditKitPage from './EditKitPage';
import { inventoryService } from '@/services/inventoryService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { InventoryItem, InventoryKit } from '@/types/inventory';

function item(id: string, name: string, sku: string, over: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id, sku, name, description: '', unitId: 1, unitPrice: 10, isActive: true, customFields: {},
    tracking: 'quantity', thicknessMm: 0, barcode: '', createdAt: '', updatedAt: '', ...over,
  };
}

const KITCHEN: InventoryKit = {
  id: 'k1', name: 'Kitchen', description: 'Counters and splash', isActive: true, itemCount: 2,
  members: [
    { quantity: 2, item: item('a', 'Countertop', 'CTR-01') },
    { quantity: 1, item: item('b', 'Old Faucet', 'OLD-01', { isActive: false }) },
  ],
  createdAt: '', updatedAt: '',
};

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname}{search}</p>;
}

function saveButton() {
  return screen.getAllByRole('button', { name: 'Save Changes' })[0];
}

function renderEdit(canDelete = true) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => resource === 'inventory_item' && (action !== 'delete' || canDelete),
  } as ReturnType<typeof useUserPermissions>);
  const router = createMemoryRouter(
    [
      { path: '/inventory/kit/:id', element: <EditKitPage /> },
      { path: '/inventory/item', element: <><p>Items page</p><Where /></> },
    ],
    { initialEntries: ['/inventory/kit/k1'] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.mocked(inventoryService.getKit).mockResolvedValue(KITCHEN);
  vi.mocked(inventoryService.updateKit).mockResolvedValue(undefined);
  vi.mocked(inventoryService.deleteKit).mockResolvedValue(undefined);
  vi.mocked(inventoryService.searchItems).mockResolvedValue({ records: [], nextCursor: '', hasMore: false });
});

describe('EditKitPage', () => {
  it('loads the kit with its items, quantities and an inactive item flagged', async () => {
    renderEdit();

    expect(await screen.findByRole('textbox', { name: 'Kit/Package Name' })).toHaveValue('Kitchen');
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Counters and splash');
    expect(screen.getByRole('spinbutton', { name: 'Quantity of Countertop' })).toHaveValue(2);
    expect(screen.getByRole('spinbutton', { name: 'Quantity of Old Faucet' })).toHaveValue(1);
    expect(screen.getByText(/OLD-01 · Inactive/)).toBeInTheDocument();
  });

  it('saves the whole kit — edited quantity, removed item — and returns to the Kits tab', async () => {
    const user = userEvent.setup();
    renderEdit();
    await screen.findByRole('textbox', { name: 'Kit/Package Name' });

    const qty = screen.getByRole('spinbutton', { name: 'Quantity of Countertop' });
    await user.clear(qty);
    await user.type(qty, '3');
    await user.click(screen.getByRole('button', { name: 'Remove Old Faucet from this kit' }));
    await user.click(saveButton());

    await waitFor(() => expect(inventoryService.updateKit).toHaveBeenCalledWith('k1', {
      name: 'Kitchen', description: 'Counters and splash', isActive: true,
      members: [{ itemId: 'a', quantity: 3 }],
    }));
    expect(await screen.findByText('Items page')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/inventory/item?tab=kits');
  });

  it('refuses a zero quantity before asking the server', async () => {
    const user = userEvent.setup();
    renderEdit();
    await screen.findByRole('textbox', { name: 'Kit/Package Name' });

    await user.clear(screen.getByRole('spinbutton', { name: 'Quantity of Countertop' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Quantity of Countertop' }), '0');
    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Quantity of Countertop');
    expect(inventoryService.updateKit).not.toHaveBeenCalled();
  });

  it('deletes the kit after confirming, and returns to the Kits tab', async () => {
    const user = userEvent.setup();
    renderEdit();
    await screen.findByRole('textbox', { name: 'Kit/Package Name' });

    await user.click(screen.getByRole('button', { name: 'Delete Kitchen' }));
    await user.click(await screen.findByRole('button', { name: 'Delete kit' }));

    await waitFor(() => expect(inventoryService.deleteKit).toHaveBeenCalledWith('k1'));
    expect(await screen.findByText('Items page')).toBeInTheDocument();
  });

  it('offers no delete to someone without delete access', async () => {
    renderEdit(false);
    await screen.findByRole('textbox', { name: 'Kit/Package Name' });

    expect(screen.queryByRole('button', { name: 'Delete Kitchen' })).not.toBeInTheDocument();
  });
});
