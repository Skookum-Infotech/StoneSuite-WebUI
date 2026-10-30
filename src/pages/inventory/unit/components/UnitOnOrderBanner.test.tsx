import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { UnitOnOrderBanner } from './UnitOnOrderBanner';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { makeUnit } from './unitFixtures';
import type { InventoryUnit } from '@/types/inventory';

function renderBanner(unit: InventoryUnit) {
  return render(<MemoryRouter><UnitOnOrderBanner unit={unit} /></MemoryRouter>);
}

function grant(hasPermission: boolean) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false, hasPermission: () => hasPermission,
  } as ReturnType<typeof useUserPermissions>);
}

const onOrder = (overrides: Partial<InventoryUnit> = {}) =>
  makeUnit({ status: 'on_order', purchaseOrderId: 'po-1', purchaseOrderNumber: 'PORD-000012', ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  grant(true);
});

describe('UnitOnOrderBanner', () => {
  it('says the slab is not in stock yet and links to the order that put it on order', () => {
    renderBanner(onOrder());

    const banner = screen.getByRole('region', { name: 'Slab on order' });
    expect(banner).toHaveTextContent('On order');
    expect(banner).toHaveTextContent('Not in stock yet');
    expect(screen.getByRole('link', { name: 'Open PORD-000012' })).toHaveAttribute('href', '/purchases/purchase_order/po-1');
  });

  it('shows the order number as plain text without read access to purchase orders', () => {
    grant(false);
    renderBanner(onOrder());

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('PORD-000012')).toBeInTheDocument();
  });

  it.each(['available', 'reserved', 'consumed', 'scrapped', 'in_transit'])('is absent for a %s slab', (status) => {
    renderBanner(makeUnit({ status, purchaseOrderId: 'po-1', purchaseOrderNumber: 'PORD-000012' }));

    expect(screen.queryByRole('region', { name: 'Slab on order' })).not.toBeInTheDocument();
  });
});
