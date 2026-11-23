import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-router-dom', async () => ({
  useNavigate: () => vi.fn(),
  Link: (await import('@/test/routerLinkStub')).RouterLinkStub,
}));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/useAIStatus', () => ({ useAIStatus: vi.fn() }));
vi.mock('@/components/tenant/documentExtraction/PendingDocumentsChip', () => ({
  PendingDocumentsChip: ({ docType }: { docType: string }) => <span>pending chip {docType}</span>,
}));
vi.mock('@/components/tenant/documentExtraction/CreateFromDocumentDialog', () => ({
  CreateFromDocumentDialog: ({ file, docType }: { file: File; docType: string }) => (
    <div role="dialog" aria-label="create from document">{docType}:{file.name}</div>
  ),
}));
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
import { useAIStatus } from '@/hooks/useAIStatus';
import { useAuthStore } from '@/store/useAuthStore';
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

function mockPermissions(canCreate: boolean, isSuperAdmin = false) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '',
    isSuperAdmin,
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

function mockAI(over: Partial<{ data: object | undefined; isLoading: boolean; isError: boolean }> = {}) {
  vi.mocked(useAIStatus).mockReturnValue({
    data: { platformEnabled: true, tenantEnabled: true, available: true, documentExtraction: true },
    isLoading: false, isError: false, ...over,
  } as unknown as ReturnType<typeof useAIStatus>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAI();
  useAuthStore.setState({ kind: 'staff' } as never);
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

    // The upload control is wrapped (button + reason popover) inside the same toolbar.
    expect(download.parentElement).toContainElement(screen.getByRole('button', { name: UPLOAD_BUTTON }));
  });

  it('is hidden without permission to create vendor bills', async () => {
    mockPermissions(false);
    renderPage();

    expect(await screen.findByText(EMPTY_LIST_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: UPLOAD_BUTTON })).not.toBeInTheDocument();
  });

  it('opens the create-from-document dialog for a picked file with this page\'s doc type', async () => {
    const user = userEvent.setup();
    mockPermissions(true);
    const { container } = renderPage();
    await screen.findByText(EMPTY_LIST_TEXT);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(['%PDF'], 'doc-1001.pdf', { type: 'application/pdf' }));

    expect(await screen.findByRole('dialog', { name: 'create from document' })).toHaveTextContent('vendor_bill:doc-1001.pdf');
    expect(screen.getByText('pending chip vendor_bill')).toBeInTheDocument();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('is disabled, with the reason, when document extraction is off', async () => {
    mockPermissions(true);
    mockAI({ data: { platformEnabled: true, tenantEnabled: false, available: true, documentExtraction: false } });
    renderPage();
    await screen.findByText(EMPTY_LIST_TEXT);

    expect(screen.getByRole('button', { name: UPLOAD_BUTTON })).toBeDisabled();
    expect(screen.getByRole('button', { name: /why/i })).toBeInTheDocument();
  });

  it('hides the whole flow for a customer-portal session', async () => {
    mockPermissions(true);
    useAuthStore.setState({ kind: 'portal' } as never);
    renderPage();
    await screen.findByText(EMPTY_LIST_TEXT);

    expect(screen.queryByRole('button', { name: UPLOAD_BUTTON })).not.toBeInTheDocument();
    expect(screen.queryByText('pending chip vendor_bill')).not.toBeInTheDocument();
  });

  it('swallows a drop with the reason when the flow is unavailable', async () => {
    mockPermissions(false);
    renderPage();
    await screen.findByText(EMPTY_LIST_TEXT);

    const file = new File(['%PDF'], 'dropped.pdf', { type: 'application/pdf' });
    const ev = new Event('drop', { bubbles: true, cancelable: true }) as Event & { dataTransfer: unknown };
    ev.dataTransfer = { files: [file], types: ['Files'] };
    window.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(screen.queryByRole('dialog', { name: 'create from document' })).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('permission'));
  });
});
