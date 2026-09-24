import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/salesOrderService', () => ({
  salesOrderService: { searchOrders: vi.fn(), transition: vi.fn() },
}));

import { SalesOrderTable } from './SalesOrderTable';
import { salesOrderService } from '@/services/salesOrderService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { SalesOrderSummary } from '@/types/salesOrder';

function mockPermissions() {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '', isSuperAdmin: false,
    hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
}

function draftOrder(nextStatusCodes: string[]): SalesOrderSummary {
  return {
    id: 'so-1',
    salesOrderNumber: 'SO-1001',
    status: 'Draft',
    statusCode: 'DRFT',
    approvalStatus: 'none',
    nextStatusCodes,
    customer: { id: 'c-1', name: 'Fontaine Builders' },
    orderDate: '2026-09-01',
    grandTotal: 1200,
  };
}

async function renderWithRow(row: SalesOrderSummary): Promise<HTMLElement> {
  vi.mocked(salesOrderService.searchOrders).mockResolvedValue({
    records: [row], nextCursor: '', hasMore: false, scope: 'all',
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <SalesOrderTable />
    </QueryClientProvider>,
  );
  const tableRow = (await screen.findByText(row.salesOrderNumber)).closest('tr');
  expect(tableRow).not.toBeNull();
  return tableRow as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// The list row's status pill must offer the record's own nextStatusCodes (what
// the backend computed, with an approval checkpoint nobody is configured to
// approve collapsed out) -- not the static transition map, which always leads
// Draft through "Submit for Approval".
describe('SalesOrderTable status pill', () => {
  it('offers Open directly from Draft, with no approval step, when nobody is configured to approve', async () => {
    const user = userEvent.setup();
    mockPermissions();
    const row = await renderWithRow(draftOrder(['CANC', 'OPEN']));

    await user.click(within(row).getByRole('button', { name: 'Draft' }));

    expect(screen.getByRole('option', { name: 'Open' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Submit for Approval' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Approved' })).not.toBeInTheDocument();
  });

  it('still offers Submit for Approval when an approver is configured', async () => {
    const user = userEvent.setup();
    mockPermissions();
    const row = await renderWithRow(draftOrder(['CANC', 'PAPV']));

    await user.click(within(row).getByRole('button', { name: 'Draft' }));

    expect(screen.getByRole('option', { name: 'Submit for Approval' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Open' })).not.toBeInTheDocument();
  });
});
