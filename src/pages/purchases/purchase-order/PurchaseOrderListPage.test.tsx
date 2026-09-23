import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/purchaseOrderService', () => ({
  purchaseOrderService: { searchPurchaseOrders: vi.fn(), transition: vi.fn() },
}));
vi.mock('@/services/lookupService', () => ({
  lookupService: { getCrmLookups: vi.fn().mockResolvedValue({ employees: [] }) },
}));

import PurchaseOrderListPage from './PurchaseOrderListPage';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { toast } from 'sonner';
import type { PurchaseOrderSummary } from '@/types/purchaseOrder';

const UPLOAD_BUTTON = 'Upload Purchase Order file';
const EMPTY_LIST_TEXT = 'No purchase orders added yet.';

const ORDER: PurchaseOrderSummary = {
  id: 'po-1',
  purchaseOrderNumber: 'PO-1001',
  status: 'Draft',
  statusCode: 'DRFT',
  approvalStatus: 'none',
  nextStatusCodes: [],
  vendor: { id: 'v-1', name: 'Marble Supply Co' },
  orderDate: '2026-09-01',
  grandTotal: 1200,
  ownerEmployeeId: null,
};

function mockPermissions(canCreate: boolean) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '',
    hasPermission: () => canCreate,
  } as ReturnType<typeof useUserPermissions>);
}

function renderPage(records: PurchaseOrderSummary[] = []) {
  vi.mocked(purchaseOrderService.searchPurchaseOrders).mockResolvedValue({
    records, nextCursor: '', hasMore: false, scope: 'all',
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PurchaseOrderListPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PurchaseOrderListPage upload button', () => {
  it('is offered in the table toolbar even when there are no purchase orders yet', async () => {
    mockPermissions(true);
    renderPage();

    expect(await screen.findByText(EMPTY_LIST_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: UPLOAD_BUTTON })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as CSV$/ })).not.toBeInTheDocument();
  });

  it('sits beside Download CSV once there are purchase orders', async () => {
    mockPermissions(true);
    renderPage([ORDER]);

    const download = await screen.findByRole('button', { name: 'Download all purchase orders as CSV' });

    expect(screen.getByRole('button', { name: UPLOAD_BUTTON }).parentElement).toBe(download.parentElement);
  });

  it('is hidden without permission to create purchase orders', async () => {
    mockPermissions(false);
    renderPage();

    expect(await screen.findByText(EMPTY_LIST_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: UPLOAD_BUTTON })).not.toBeInTheDocument();
  });

  it('acknowledges a picked file without sending anything yet', async () => {
    const user = userEvent.setup();
    mockPermissions(true);
    const { container } = renderPage();
    await screen.findByText(EMPTY_LIST_TEXT);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(['%PDF'], 'po-1001.pdf', { type: 'application/pdf' }));

    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('po-1001.pdf'));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
