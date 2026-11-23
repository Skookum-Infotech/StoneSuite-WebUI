import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { UnitAllocationChips } from './UnitAllocationChips';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { makeAllocatedUnit, makeUnit } from './unitFixtures';
import type { InventoryUnit } from '@/types/inventory';

function can(...granted: string[]) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => granted.includes(`${resource}:${action}`),
  } as ReturnType<typeof useUserPermissions>);
}

function renderChips(unit: InventoryUnit) {
  return render(<MemoryRouter><UnitAllocationChips unit={unit} /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  can('sales_order:read', 'installation:read');
});

describe('UnitAllocationChips', () => {
  it('links to the sales order and the fabrication job a slab is allocated to', () => {
    renderChips(makeAllocatedUnit());

    expect(screen.getByRole('link', { name: 'Sales order SORD-000003' })).toHaveAttribute('href', '/sales/sales_order/so-3');
    expect(screen.getByRole('link', { name: 'Fabrication job FJOB-000007' })).toHaveAttribute('href', '/sales/installation/job-7');
  });

  it('shows the same two links on a slab the job has already cut', () => {
    renderChips(makeAllocatedUnit({ status: 'consumed' }));

    expect(screen.getByRole('link', { name: 'Sales order SORD-000003' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fabrication job FJOB-000007' })).toBeInTheDocument();
  });

  it('shows only the job when its order is not known', () => {
    const unit = makeAllocatedUnit();
    unit.usage = { ...unit.usage!, salesOrderId: undefined, salesOrderNumber: undefined };
    renderChips(unit);

    expect(screen.getByRole('link', { name: 'Fabrication job FJOB-000007' })).toBeInTheDocument();
    expect(screen.queryByText(/sales order/i)).not.toBeInTheDocument();
  });

  it('renders nothing for a slab no job has claimed', () => {
    const { container } = renderChips(makeUnit());

    expect(container).toBeEmptyDOMElement();
  });

  it('names a record but does not link it to a user who may not open it', () => {
    can('installation:read');
    renderChips(makeAllocatedUnit());

    expect(screen.getByLabelText('Sales order SORD-000003')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sales order SORD-000003' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fabrication job FJOB-000007' })).toBeInTheDocument();
  });
});
