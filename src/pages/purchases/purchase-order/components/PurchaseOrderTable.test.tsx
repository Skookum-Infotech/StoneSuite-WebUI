import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/purchaseOrderService', () => ({
  purchaseOrderService: { searchPurchaseOrders: vi.fn(), transition: vi.fn() },
}));
vi.mock('@/services/lookupService', () => ({
  lookupService: { getCrmLookups: vi.fn().mockResolvedValue({ employees: [] }) },
}));

import { PurchaseOrderTable } from './PurchaseOrderTable';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { PurchaseOrderSummary } from '@/types/purchaseOrder';

// Every permission granted; `isSuperAdmin` is the only thing that decides
// whether the list row's status is a dropdown or a read-only pill.
function mockPermissions(isSuperAdmin = true) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '',
    isSuperAdmin,
    hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
}

function draftOrder(nextStatusCodes: string[]): PurchaseOrderSummary {
  return {
    id: 'po-1',
    purchaseOrderNumber: 'PO-1001',
    status: 'Draft',
    statusCode: 'DRFT',
    approvalStatus: 'none',
    nextStatusCodes,
    vendor: { id: 'v-1', name: 'Marble Supply Co' },
    orderDate: '2026-09-01',
    grandTotal: 1200,
    ownerEmployeeId: null,
  };
}

async function renderWithRow(row: PurchaseOrderSummary): Promise<HTMLElement> {
  vi.mocked(purchaseOrderService.searchPurchaseOrders).mockResolvedValue({
    records: [row], nextCursor: '', hasMore: false, scope: 'all',
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <PurchaseOrderTable />
    </QueryClientProvider>,
  );
  const tableRow = (await screen.findByText(row.purchaseOrderNumber)).closest('tr');
  expect(tableRow).not.toBeNull();
  return tableRow as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// Only a super admin may change status from the list; everyone else sees the
// status but gets no control for it (they move an order from its Detail page).
describe('PurchaseOrderTable status for a non-admin', () => {
  it('shows the status as plain text, with no dropdown to change it', async () => {
    mockPermissions(false);
    const row = await renderWithRow(draftOrder(['CANC', 'SENT']));

    expect(within(row).getByText('Draft')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Draft' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows the same status pill dropdown to a super admin', async () => {
    mockPermissions(true);
    const row = await renderWithRow(draftOrder(['CANC', 'SENT']));

    expect(within(row).getByRole('button', { name: 'Draft' })).toBeInTheDocument();
  });
});

// The list row's status pill must offer the record's own nextStatusCodes (what
// the backend computed, with an approval checkpoint nobody is configured to
// approve collapsed out) -- not the static transition map, which always leads
// Draft through "Submit for Approval".
describe('PurchaseOrderTable status pill', () => {
  it('offers Send to Vendor directly from Draft, with no approval step, when nobody is configured to approve', async () => {
    const user = userEvent.setup();
    mockPermissions();
    const row = await renderWithRow(draftOrder(['CANC', 'SENT']));

    await user.click(within(row).getByRole('button', { name: 'Draft' }));

    expect(screen.getByRole('option', { name: 'Send to Vendor' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Submit for Approval' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Approve/ })).not.toBeInTheDocument();
  });

  it('still offers Submit for Approval when an approver is configured', async () => {
    const user = userEvent.setup();
    mockPermissions();
    const row = await renderWithRow(draftOrder(['CANC', 'PAPV']));

    await user.click(within(row).getByRole('button', { name: 'Draft' }));

    expect(screen.getByRole('option', { name: 'Submit for Approval' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Send to Vendor' })).not.toBeInTheDocument();
  });
});
