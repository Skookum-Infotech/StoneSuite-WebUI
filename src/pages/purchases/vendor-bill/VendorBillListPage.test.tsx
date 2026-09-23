import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/vendorBillService', () => ({
  vendorBillService: { searchVendorBills: vi.fn(), transition: vi.fn() },
}));
vi.mock('@/services/lookupService', () => ({
  lookupService: { getCrmLookups: vi.fn().mockResolvedValue({ employees: [] }) },
}));

import VendorBillListPage from './VendorBillListPage';
import { vendorBillService } from '@/services/vendorBillService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { toast } from 'sonner';
import type { VendorBillSummary } from '@/types/vendorBill';

const UPLOAD_BUTTON = 'Upload Vendor Bill file';
const EMPTY_LIST_TEXT = 'No vendor bills added yet.';

const BILL: VendorBillSummary = {
  id: 'vb-1',
  vendorBillNumber: 'VB-1001',
  status: 'Draft',
  statusCode: 'DRFT',
  approvalStatus: 'none',
  nextStatusCodes: [],
  vendor: { id: 'v-1', name: 'Marble Supply Co' },
  vendorInvoiceNumber: 'INV-77',
  billDate: '2026-09-01',
  grandTotal: 1200,
  amountPaid: 0,
  balanceDue: 1200,
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

function renderPage(records: VendorBillSummary[] = []) {
  vi.mocked(vendorBillService.searchVendorBills).mockResolvedValue({
    records, nextCursor: '', hasMore: false, scope: 'all',
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VendorBillListPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('VendorBillListPage upload button', () => {
  it('is offered in the table toolbar even when there are no vendor bills yet', async () => {
    mockPermissions(true);
    renderPage();

    expect(await screen.findByText(EMPTY_LIST_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: UPLOAD_BUTTON })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as CSV$/ })).not.toBeInTheDocument();
  });

  it('sits beside Download CSV once there are vendor bills', async () => {
    mockPermissions(true);
    renderPage([BILL]);

    const download = await screen.findByRole('button', { name: 'Download all vendor bills as CSV' });

    expect(screen.getByRole('button', { name: UPLOAD_BUTTON }).parentElement).toBe(download.parentElement);
  });

  it('is hidden without permission to create vendor bills', async () => {
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
    await user.upload(fileInput, new File(['%PDF'], 'bill-77.pdf', { type: 'application/pdf' }));

    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('bill-77.pdf'));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
