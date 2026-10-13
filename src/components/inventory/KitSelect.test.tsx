import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';

vi.mock('@/services/inventoryService', () => ({
  inventoryService: { searchKits: vi.fn(), createKit: vi.fn() },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { KitSelect } from './KitSelect';
import { inventoryService } from '@/services/inventoryService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { InventoryKit, KitRef } from '@/types/inventory';

function kit(id: string, name: string, over: Partial<InventoryKit> = {}): InventoryKit {
  return { id, name, description: '', isActive: true, itemCount: 3, createdAt: '', updatedAt: '', ...over };
}

function mockCanCreate(allowed: boolean) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => allowed && resource === 'inventory_item' && action === 'create',
  } as ReturnType<typeof useUserPermissions>);
}

function Harness({ initial = [], onChange = vi.fn() }: { initial?: KitRef[]; onChange?: (k: KitRef[]) => void }) {
  const [value, setValue] = useState<KitRef[]>(initial);
  return (
    <>
      <KitSelect value={value} onChange={(next) => { setValue(next); onChange(next); }} />
      <output data-testid="chosen">{value.map((k) => k.name).join('|')}</output>
    </>
  );
}

function renderSelect(props: Parameters<typeof Harness>[0] = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCanCreate(true);
  vi.mocked(inventoryService.searchKits).mockResolvedValue({
    records: [kit('k1', 'Kitchen'), kit('k2', 'Bathroom'), kit('k3', 'Retired', { isActive: false })],
    nextCursor: '', hasMore: false,
  });
});

describe('KitSelect', () => {
  it('lists active kits and adds the chosen one as a chip', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderSelect({ onChange });

    await user.click(screen.getByRole('textbox', { name: 'Add to a kit/package' }));
    expect(await screen.findByRole('button', { name: /Kitchen/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retired/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Kitchen/ }));

    expect(onChange).toHaveBeenCalledWith([{ id: 'k1', name: 'Kitchen' }]);
    expect(screen.getByRole('list', { name: 'Kit/Packages this item is in' })).toHaveTextContent('Kitchen');
  });

  it('does not offer a kit that is already chosen, and a chip can be removed', async () => {
    const user = userEvent.setup();
    renderSelect({ initial: [{ id: 'k1', name: 'Kitchen' }] });

    await user.click(screen.getByRole('textbox', { name: 'Add to a kit/package' }));
    expect(await screen.findByRole('button', { name: /Bathroom/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Kitchen/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove from kit/package Kitchen' }));
    expect(screen.getByTestId('chosen')).toHaveTextContent('');
  });

  it('creates a kit by name on the spot and chooses it', async () => {
    vi.mocked(inventoryService.searchKits).mockResolvedValue({ records: [], nextCursor: '', hasMore: false });
    vi.mocked(inventoryService.createKit).mockResolvedValue(kit('k9', 'Garage', { members: [] }));
    const user = userEvent.setup();
    renderSelect();

    await user.type(screen.getByRole('textbox', { name: 'Add to a kit/package' }), 'Garage');
    await user.click(await screen.findByRole('button', { name: 'Add “Garage” as a new kit/package' }));

    expect(inventoryService.createKit).toHaveBeenCalledWith({ name: 'Garage', description: '', members: [] });
    expect(await screen.findByTestId('chosen')).toHaveTextContent('Garage');
  });

  it('shows the server’s message when the name is taken by an inactive kit', async () => {
    vi.mocked(inventoryService.searchKits).mockResolvedValue({ records: [], nextCursor: '', hasMore: false });
    vi.mocked(inventoryService.createKit).mockRejectedValue(
      new AxiosError('conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 409, statusText: 'Conflict', headers: {}, config: { headers: new AxiosHeaders() },
        data: { success: false, message: 'A kit named "Retired" already exists (Inactive).' },
      }),
    );
    const user = userEvent.setup();
    renderSelect();

    await user.type(screen.getByRole('textbox', { name: 'Add to a kit/package' }), 'Retired');
    await user.click(await screen.findByRole('button', { name: 'Add “Retired” as a new kit/package' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/);
    expect(screen.getByTestId('chosen')).toHaveTextContent('');
  });

  it('does not offer to create when the name is already a kit, or the user cannot create', async () => {
    const user = userEvent.setup();
    renderSelect();
    await user.type(screen.getByRole('textbox', { name: 'Add to a kit/package' }), 'kitchen');
    await screen.findByRole('button', { name: /Kitchen/ });
    expect(screen.queryByRole('button', { name: /as a new kit/ })).not.toBeInTheDocument();
  });

  it('hides creation from a user without create access', async () => {
    mockCanCreate(false);
    vi.mocked(inventoryService.searchKits).mockResolvedValue({ records: [], nextCursor: '', hasMore: false });
    const user = userEvent.setup();
    renderSelect();

    await user.type(screen.getByRole('textbox', { name: 'Add to a kit/package' }), 'Garage');
    expect(await screen.findByText(/No more kit\/packages match/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as a new kit/ })).not.toBeInTheDocument();
  });
});
