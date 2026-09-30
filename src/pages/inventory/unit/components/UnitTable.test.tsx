import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type * as ReactRouter from 'react-router-dom';

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof ReactRouter>('react-router-dom')),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/inventoryUnitService', () => ({
  inventoryUnitService: { searchUnits: vi.fn() },
}));
vi.mock('./MoveUnitDialog', () => ({ MoveUnitDialog: () => null }));
vi.mock('./ScrapUnitDialog', () => ({ ScrapUnitDialog: () => null }));
vi.mock('./CutUnitDialog', () => ({ CutUnitDialog: () => null }));

import { UnitTable } from './UnitTable';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { makeAllocatedUnit, makeCutUnit, makeUnit } from './unitFixtures';
import type { UnitSearchRequest } from '@/types/inventory';

const searchUnits = vi.mocked(inventoryUnitService.searchUnits);

function renderTable() {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false, hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
  searchUnits.mockResolvedValue({
    records: [
      makeUnit({ id: 'u1', serial: 'PO-00012-001' }),
      makeCutUnit(30, 15.2, 2, { id: 'u2', serial: 'PO-00012-002' }),
      makeAllocatedUnit({ id: 'u3', serial: 'PO-00012-003' }),
    ],
    nextCursor: '', hasMore: false,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UnitTable />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function lastSearch(): UnitSearchRequest {
  const calls = searchUnits.mock.calls;
  return calls[calls.length - 1][0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UnitTable', () => {
  it('has a Consumption column that says what happened to each piece', async () => {
    renderTable();

    expect(await screen.findByRole('columnheader', { name: 'Consumption' })).toBeInTheDocument();
    const untouched = (await screen.findByText('PO-00012-001')).closest('tr') as HTMLElement;
    expect(within(untouched).getByText('Untouched')).toBeInTheDocument();
    const cut = screen.getByText('PO-00012-002').closest('tr') as HTMLElement;
    expect(within(cut).getByText('66% used · 15.20 sq ft back')).toBeInTheDocument();
  });

  it('has an Allocated To column naming the sales order and job a slab is held for', async () => {
    renderTable();

    expect(await screen.findByRole('columnheader', { name: 'Allocated To' })).toBeInTheDocument();
    const held = (await screen.findByText('PO-00012-003')).closest('tr') as HTMLElement;
    expect(within(held).getByRole('link', { name: 'Sales order SORD-000003' })).toHaveAttribute('href', '/sales/sales_order/so-3');
    expect(within(held).getByRole('link', { name: 'Fabrication job FJOB-000007' })).toHaveAttribute('href', '/sales/installation/job-7');
  });

  it('leaves the Allocated To cell blank for a slab nobody has claimed', async () => {
    renderTable();

    const free = (await screen.findByText('PO-00012-001')).closest('tr') as HTMLElement;
    expect(within(free).getByLabelText('Not allocated')).toBeInTheDocument();
    expect(within(free).queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows what each area is measured in', async () => {
    renderTable();

    const row = (await screen.findByText('PO-00012-001')).closest('tr') as HTMLElement;
    expect(within(row).getByText('45.20 sq ft')).toBeInTheDocument();
  });

  it('is just the table — no totals strips above it', async () => {
    renderTable();
    await screen.findByText('PO-00012-001');

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^(In stock|Reserved|Consumed|Scrapped):/ })).not.toBeInTheDocument();
  });

  it('filters by status and clears it again', async () => {
    renderTable();
    const user = userEvent.setup();
    await screen.findByText('PO-00012-001');

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'consumed');
    await vi.waitFor(() => expect(lastSearch().filters).toEqual([{ field: 'status', op: 'eq', value: 'consumed' }]));

    await user.click(screen.getByRole('button', { name: /clear/i }));
    await vi.waitFor(() => expect(lastSearch().filters).toEqual([]));
  });
});
