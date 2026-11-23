import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { UnitAllocationBanner } from './UnitAllocationBanner';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { makeAllocatedUnit, makeUnit } from './unitFixtures';
import type { InventoryUnit } from '@/types/inventory';

function renderBanner(unit: InventoryUnit) {
  return render(<MemoryRouter><UnitAllocationBanner unit={unit} /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false, hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
});

describe('UnitAllocationBanner', () => {
  it('says a held slab is reserved for the order and job, with a link to each', () => {
    renderBanner(makeAllocatedUnit());

    const banner = screen.getByRole('region', { name: 'Slab allocation' });
    expect(banner).toHaveTextContent('Reserved for');
    expect(within(banner).getByRole('link', { name: 'Sales order SORD-000003' })).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'Fabrication job FJOB-000007' })).toBeInTheDocument();
  });

  it('says a cut slab was cut for them', () => {
    renderBanner(makeAllocatedUnit({ status: 'consumed' }));

    expect(screen.getByRole('region', { name: 'Slab allocation' })).toHaveTextContent('Cut for');
  });

  it('is absent for a slab nobody has claimed', () => {
    renderBanner(makeUnit());

    expect(screen.queryByRole('region', { name: 'Slab allocation' })).not.toBeInTheDocument();
  });
});
