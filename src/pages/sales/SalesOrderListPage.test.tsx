import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), Link: ({ children }: { children: unknown }) => children }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));
vi.mock('@/store/useAuthStore', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/hooks/useAIStatus', () => ({ useAIStatus: vi.fn() }));
vi.mock('@/services/documentExtractionService', () => ({ documentExtractionService: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/components/tenant/documentExtraction/CreateFromDocumentDialog', () => ({
  CreateFromDocumentDialog: ({ file }: { file: File }) => <div role="dialog">Dialog for {file.name}</div>,
}));
vi.mock('@/services/salesOrderService', () => ({
  salesOrderService: { searchOrders: vi.fn(), transition: vi.fn() },
}));

import SalesOrderListPage from './SalesOrderListPage';
import { salesOrderService } from '@/services/salesOrderService';
import { useAuthStore } from '@/store/useAuthStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAIStatus } from '@/hooks/useAIStatus';
import type { SalesOrderSummary } from '@/types/salesOrder';

const UPLOAD_BUTTON = 'Upload Sales Order file';
const EMPTY_LIST_TEXT = 'No sales orders added yet.';

const ORDER: SalesOrderSummary = {
  id: 'so-1',
  salesOrderNumber: 'SO-1001',
  status: 'Draft',
  statusCode: 'DRFT',
  approvalStatus: 'none',
  nextStatusCodes: [],
  orderDate: '2026-09-01',
  grandTotal: 1200,
};

const AI_OFF_REASON = 'AI features are turned off for your workspace. A workspace admin can turn them on in Settings.';

function mockSession(kind?: 'portal', opts: { canCreate?: boolean; extraction?: boolean | undefined; aiLoading?: boolean; tenantEnabled?: boolean } = {}) {
  const { canCreate = true, extraction = true, aiLoading = false, tenantEnabled = true } = opts;
  vi.mocked(useAuthStore).mockImplementation((selector) => (selector as (s: unknown) => unknown)({ kind }));
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => (resource === 'sales_order' && action === 'create' ? canCreate : true),
  } as ReturnType<typeof useUserPermissions>);
  vi.mocked(useAIStatus).mockReturnValue({
    data: aiLoading ? undefined : { platformEnabled: true, tenantEnabled, available: tenantEnabled, documentExtraction: extraction },
    isLoading: aiLoading,
  } as ReturnType<typeof useAIStatus>);
}

function renderPage(records: SalesOrderSummary[] = []) {
  vi.mocked(salesOrderService.searchOrders).mockResolvedValue({
    records, nextCursor: '', hasMore: false, scope: 'all',
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SalesOrderListPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SalesOrderListPage upload button', () => {
  it('is offered in the table toolbar even when there are no sales orders yet', async () => {
    mockSession();
    renderPage();

    expect(await screen.findByText(EMPTY_LIST_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: UPLOAD_BUTTON })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as CSV$/ })).not.toBeInTheDocument();
  });

  it('sits beside Download CSV once there are sales orders', async () => {
    mockSession();
    renderPage([ORDER]);

    const download = await screen.findByRole('button', { name: 'Download all sales orders as CSV' });

    // The upload control is wrapped (button + reason popover) inside the same toolbar.
    expect(download.parentElement).toContainElement(screen.getByRole('button', { name: UPLOAD_BUTTON }));
  });

  it('is hidden for a customer-portal session', async () => {
    mockSession('portal');
    renderPage();

    expect(await screen.findByText(EMPTY_LIST_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: UPLOAD_BUTTON })).not.toBeInTheDocument();
  });

  it('is hidden without sales_order:create', async () => {
    mockSession(undefined, { canCreate: false });
    renderPage();

    expect(await screen.findByText(EMPTY_LIST_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: UPLOAD_BUTTON })).not.toBeInTheDocument();
  });

  it('is disabled with a reason when AI features are off for the workspace', async () => {
    mockSession(undefined, { extraction: false, tenantEnabled: false });
    renderPage();

    const button = await screen.findByRole('button', { name: UPLOAD_BUTTON });
    expect(button).toBeDisabled();
    expect(screen.getByText(AI_OFF_REASON)).toBeInTheDocument();
    expect(button).toHaveAccessibleDescription(AI_OFF_REASON);
  });

  it('is disabled without a reason while the AI status is still loading', async () => {
    mockSession(undefined, { aiLoading: true });
    renderPage();

    expect(await screen.findByRole('button', { name: UPLOAD_BUTTON })).toBeDisabled();
    expect(screen.queryByText(AI_OFF_REASON)).not.toBeInTheDocument();
  });

  it('opens the create-from-document dialog with the picked file', async () => {
    const user = userEvent.setup();
    mockSession();
    const { container } = renderPage();
    await screen.findByText(EMPTY_LIST_TEXT);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(['%PDF'], 'so-1001.pdf', { type: 'application/pdf' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent('so-1001.pdf');
  });

  it('does not show the Pending documents chip when nothing is ready', async () => {
    mockSession();
    renderPage();

    await screen.findByText(EMPTY_LIST_TEXT);
    expect(screen.queryByText(/Pending documents/)).not.toBeInTheDocument();
  });
});
