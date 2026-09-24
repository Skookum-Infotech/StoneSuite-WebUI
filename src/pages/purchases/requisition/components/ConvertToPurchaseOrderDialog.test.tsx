import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

vi.mock('@/services/vendorService', () => ({
  vendorService: { searchVendors: vi.fn() },
}));
vi.mock('@/services/requisitionService', () => ({
  requisitionService: { convert: vi.fn() },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { ConvertToPurchaseOrderDialog } from './ConvertToPurchaseOrderDialog';
import { vendorService } from '@/services/vendorService';
import { useUserPermissions } from '@/hooks/useUserPermissions';

function mockCanCreateVendor(allowed: boolean) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => allowed && resource === 'vendor' && action === 'create',
  } as ReturnType<typeof useUserPermissions>);
}

function renderDialog(onClose = vi.fn()) {
  vi.mocked(vendorService.searchVendors).mockResolvedValue({ records: [], nextCursor: '', hasMore: false, scope: 'all' });
  const router = createMemoryRouter(
    [
      {
        path: '/requisition',
        element: <ConvertToPurchaseOrderDialog requisitionId="r1" requisitionNumber="REQ-1" onClose={onClose} onConverted={vi.fn()} />,
      },
      { path: '/purchases/vendor/new', element: <p>New Vendor page</p> },
    ],
    { initialEntries: ['/requisition'] },
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
  mockCanCreateVendor(true);
});

describe('ConvertToPurchaseOrderDialog — Create Vendor (lite round trip)', () => {
  it('warns and offers Create Vendor for an unmatched name', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByRole('textbox', { name: 'Search vendor' }), 'Nero Marble Co');

    expect(await screen.findByText(/“Nero Marble Co” isn't an existing vendor/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create “Nero Marble Co” as a new vendor' })).toBeInTheDocument();
  });

  it('warns a confirm about losing the conversion before leaving, and only then navigates', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog(onClose);

    await user.type(screen.getByRole('textbox', { name: 'Search vendor' }), 'Nero Marble Co');
    await user.click(await screen.findByRole('button', { name: 'Create “Nero Marble Co” as a new vendor' }));

    expect(screen.getByRole('dialog', { name: 'Leave to create a vendor?' })).toBeInTheDocument();
    expect(screen.getByText(/closes the conversion dialog without picking a vendor/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Create Vendor' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('New Vendor page')).toBeInTheDocument();
  });

  it('stays on the conversion dialog when the user backs out of the confirm', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog(onClose);

    await user.type(screen.getByRole('textbox', { name: 'Search vendor' }), 'Nero Marble Co');
    await user.click(await screen.findByRole('button', { name: 'Create “Nero Marble Co” as a new vendor' }));
    await user.click(screen.getByRole('button', { name: 'Stay here' }));

    expect(screen.queryByRole('dialog', { name: 'Leave to create a vendor?' })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Convert to Purchase Order' })).toBeInTheDocument();
  });

  it('only warns, with no create action, when the user cannot create vendors', async () => {
    mockCanCreateVendor(false);
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByRole('textbox', { name: 'Search vendor' }), 'Nero Marble Co');

    expect(await screen.findByText(/Ask someone with vendor access/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as a new vendor/ })).not.toBeInTheDocument();
  });
});
