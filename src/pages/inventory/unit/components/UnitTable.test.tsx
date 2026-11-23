import { pickOption } from '@/test/selectHelpers';
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
  inventoryUnitService: { searchUnits: vi.fn(), release: vi.fn() },
}));
vi.mock('./ReserveUnitDialog', () => ({
  ReserveUnitDialog: ({ unit }: { unit: { serial: string } }) => <div role="dialog" aria-label={`Reserve ${unit.serial}`} />,
}));
vi.mock('./ScrapUnitDialog', () => ({ ScrapUnitDialog: () => null }));
vi.mock('./CutUnitDialog', () => ({ CutUnitDialog: () => null }));

import { UnitTable } from './UnitTable';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { makeAllocatedUnit, makeCutUnit, makeUnit } from './unitFixtures';
import type { InventoryUnit, UnitSearchRequest } from '@/types/inventory';

const searchUnits = vi.mocked(inventoryUnitService.searchUnits);

const DEFAULT_RECORDS = (): InventoryUnit[] => [
  makeUnit({ id: 'u1', serial: 'PO-00012-001' }),
  makeCutUnit(30, 15.2, 2, { id: 'u2', serial: 'PO-00012-002' }),
  makeAllocatedUnit({ id: 'u3', serial: 'PO-00012-003' }),
];

function renderTable(records: InventoryUnit[] = DEFAULT_RECORDS()) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false, hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
  searchUnits.mockResolvedValue({ records, nextCursor: '', hasMore: false });
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
  // A bin move is requested through a Bin Transfer, which can be approved and
  // has a document; an instant move from a list row would walk around that.
  it('has no instant move on a row — only cut and scrap', async () => {
    renderTable();
    const row = (await screen.findByText('PO-00012-001')).closest('tr') as HTMLElement;

    expect(within(row).getByRole('button', { name: 'Cut PO-00012-001' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Scrap PO-00012-001' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /move/i })).not.toBeInTheDocument();
  });

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
    // The serial itself is a link to the unit; there must be no second one to a claimant.
    expect(within(free).getAllByRole('link').map((a) => a.textContent)).toEqual(['PO-00012-001']);
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

    await pickOption(screen.getByLabelText('Filter by status'), 'consumed');
    await vi.waitFor(() => expect(lastSearch().filters).toEqual([{ field: 'status', op: 'eq', value: 'consumed' }]));

    await user.click(screen.getByRole('button', { name: /clear/i }));
    await vi.waitFor(() => expect(lastSearch().filters).toEqual([]));
  });
});

describe('UnitTable — received slabs and customer reservations', () => {
  const heldForCustomer = (): InventoryUnit => makeUnit({
    id: 'u9', serial: 'PO-00012-009', status: 'reserved',
    reservedCustomerId: 'cust-1', reservedCustomerName: 'Acme Kitchens',
  });

  it('offers Reserve on an available slab and opens the customer dialog', async () => {
    renderTable();
    const row = (await screen.findByText('PO-00012-001')).closest('tr') as HTMLElement;

    await userEvent.setup().click(within(row).getByRole('button', { name: 'Reserve PO-00012-001 for a customer' }));

    expect(screen.getByRole('dialog', { name: 'Reserve PO-00012-001' })).toBeInTheDocument();
  });

  it('cannot reserve a slab that is not available', async () => {
    renderTable([makeUnit({ id: 'u5', serial: 'PO-00012-005', status: 'received' }), makeCutUnit(30, 15.2, 2, { id: 'u2', serial: 'PO-00012-002' })]);
    const received = (await screen.findByText('PO-00012-005')).closest('tr') as HTMLElement;
    const cut = screen.getByText('PO-00012-002').closest('tr') as HTMLElement;

    expect(within(received).getByRole('button', { name: 'Reserve PO-00012-005 for a customer' })).toBeDisabled();
    expect(within(cut).getByRole('button', { name: 'Reserve PO-00012-002 for a customer' })).toBeDisabled();
  });

  it('lets a received slab be scrapped but not cut — it has no bin yet', async () => {
    renderTable([makeUnit({ id: 'u5', serial: 'PO-00012-005', status: 'received' })]);
    const row = (await screen.findByText('PO-00012-005')).closest('tr') as HTMLElement;

    expect(within(row).getByRole('button', { name: 'Scrap PO-00012-005' })).toBeEnabled();
    expect(within(row).getByRole('button', { name: 'Cut PO-00012-005' })).toBeDisabled();
  });

  it('names the customer a slab is reserved for and offers Release instead of Reserve', async () => {
    renderTable([heldForCustomer()]);
    const row = (await screen.findByText('PO-00012-009')).closest('tr') as HTMLElement;

    expect(within(row).getByText('Acme Kitchens')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Release reservation on PO-00012-009' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /^Reserve / })).not.toBeInTheDocument();
  });

  it('releases a customer reservation', async () => {
    vi.mocked(inventoryUnitService.release).mockResolvedValue({ success: true });
    renderTable([heldForCustomer()]);
    const row = (await screen.findByText('PO-00012-009')).closest('tr') as HTMLElement;

    await userEvent.setup().click(within(row).getByRole('button', { name: 'Release reservation on PO-00012-009' }));

    await vi.waitFor(() => expect(inventoryUnitService.release).toHaveBeenCalledWith('u9'));
    expect(await screen.findByText('PO-00012-009 is available again.')).toBeInTheDocument();
  });

  it('filters by the Received status', async () => {
    renderTable();
    await screen.findByText('PO-00012-001');

    await pickOption(screen.getByLabelText('Filter by status'), 'received');
    await vi.waitFor(() => expect(lastSearch().filters).toEqual([{ field: 'status', op: 'eq', value: 'received' }]));
  });
});
