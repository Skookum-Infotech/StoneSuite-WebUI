import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';

vi.mock('@/services/inventoryService', () => ({
  inventoryService: { searchItems: vi.fn(), createKit: vi.fn() },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import AddKitPage from './AddKitPage';
import { inventoryService } from '@/services/inventoryService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { INVENTORY_RETURN_STATE_KEY } from '@/lib/inventoryItemReturn';
import type { InventoryItem, InventoryKit } from '@/types/inventory';

const COUNTERTOP = {
  id: 'i-ctr', sku: 'CTR-01', name: 'Countertop', description: '', unitId: 1, unitPrice: 100, isActive: true,
  customFields: {}, tracking: 'quantity', thicknessMm: 0, barcode: '', createdAt: '', updatedAt: '',
} as InventoryItem;

const CREATED: InventoryKit = {
  id: 'kit-9', name: 'Kitchen', description: '', isActive: true, itemCount: 1, createdAt: '', updatedAt: '',
  members: [{ quantity: 2, item: COUNTERTOP }],
};

// Shows where the page sent the user, and the router state it sent with them.
function Landing({ label }: { label: string }) {
  const location = useLocation();
  const state = location.state as Record<string, { createdKit?: InventoryKit | null }> | null;
  const created = state?.[INVENTORY_RETURN_STATE_KEY]?.createdKit;
  return (
    <div>
      <p>On {label}</p>
      <p data-testid="search">{location.search}</p>
      <p data-testid="created">{created === undefined ? 'no state' : created ? created.name : 'cancelled'}</p>
    </div>
  );
}

// The header and the action bar each carry a Save Kit/Package button.
function saveButton() {
  return screen.getAllByRole('button', { name: 'Save Kit/Package' })[0];
}

function renderAdd(initialPath: string) {
  const router = createMemoryRouter(
    [
      { path: '/inventory/kit/new', element: <AddKitPage /> },
      { path: '/inventory/item', element: <Landing label="items" /> },
      { path: '/sales/sales_order/new', element: <Landing label="document" /> },
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

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom has no scrollIntoView; the error banner scrolls itself into view.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false, hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
  vi.mocked(inventoryService.searchItems).mockResolvedValue({ records: [COUNTERTOP], nextCursor: '', hasMore: false });
  vi.mocked(inventoryService.createKit).mockResolvedValue(CREATED);
});

describe('AddKitPage', () => {
  it('prefills the name a picker handed over', () => {
    renderAdd('/inventory/kit/new?name=Kitchen&returnTo=%2Fsales%2Fsales_order%2Fnew');

    expect(screen.getByRole('textbox', { name: 'Kit/Package Name' })).toHaveValue('Kitchen');
    expect(screen.getAllByText(/You'll go back to your document after saving/).length).toBeGreaterThan(0);
  });

  it('refuses to save without a name', async () => {
    const user = userEvent.setup();
    renderAdd('/inventory/kit/new');

    // Spaces get past the field's native `required`, so the form's own check runs.
    await user.type(screen.getByRole('textbox', { name: 'Kit/Package Name' }), '   ');
    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Kit/Package Name');
    expect(inventoryService.createKit).not.toHaveBeenCalled();
  });

  it('adds items with their quantities and saves the whole kit, then lands on the Kits tab', async () => {
    const user = userEvent.setup();
    renderAdd('/inventory/kit/new?name=Kitchen');

    await user.type(screen.getByRole('textbox', { name: 'Search inventory item' }), 'Counter');
    await user.click(await screen.findByRole('button', { name: /Countertop/ }));
    const qty = screen.getByRole('spinbutton', { name: 'Quantity of Countertop' });
    await user.clear(qty);
    await user.type(qty, '2');
    await user.click(saveButton());

    await waitFor(() => expect(inventoryService.createKit).toHaveBeenCalledWith({
      name: 'Kitchen', description: '', isActive: true,
      members: [{ itemId: 'i-ctr', quantity: 2 }],
    }));
    expect(await screen.findByText('On items')).toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=kits');
  });

  it('goes back to the document with the created kit in router state', async () => {
    const user = userEvent.setup();
    renderAdd('/inventory/kit/new?name=Kitchen&returnTo=%2Fsales%2Fsales_order%2Fnew');

    await user.click(saveButton());

    expect(await screen.findByText('On document')).toBeInTheDocument();
    expect(screen.getByTestId('created')).toHaveTextContent('Kitchen');
  });

  it('goes back with no kit when cancelled', async () => {
    const user = userEvent.setup();
    renderAdd('/inventory/kit/new?name=Kitchen&returnTo=%2Fsales%2Fsales_order%2Fnew');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('On document')).toBeInTheDocument();
    expect(screen.getByTestId('created')).toHaveTextContent('cancelled');
  });

  it('ignores an unsafe return path', async () => {
    const user = userEvent.setup();
    renderAdd('/inventory/kit/new?name=Kitchen&returnTo=%2F%2Fevil.example.com');

    await user.click(saveButton());

    expect(await screen.findByText('On items')).toBeInTheDocument();
  });

  it('shows the server’s message for a duplicate name and stays on the page', async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryService.createKit).mockRejectedValue(
      new AxiosError('conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 409, statusText: 'Conflict', headers: {}, config: { headers: new AxiosHeaders() },
        data: { success: false, message: 'A kit named "Kitchen" already exists (Active). Use the existing record, or choose a different name.' },
      }),
    );
    renderAdd('/inventory/kit/new?name=Kitchen');

    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/);
    expect(screen.getByRole('textbox', { name: 'Kit/Package Name' })).toHaveValue('Kitchen');
  });
});
