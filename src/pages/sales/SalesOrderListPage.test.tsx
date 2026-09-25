import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));
vi.mock('@/store/useAuthStore', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/salesOrderService', () => ({
  salesOrderService: { searchOrders: vi.fn(), transition: vi.fn() },
}));

import SalesOrderListPage from './SalesOrderListPage';
import { salesOrderService } from '@/services/salesOrderService';
import { useAuthStore } from '@/store/useAuthStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { toast } from 'sonner';
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

function mockSession(kind?: 'portal') {
  vi.mocked(useAuthStore).mockImplementation((selector) => (selector as (s: unknown) => unknown)({ kind }));
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '', isSuperAdmin: false,
    hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
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

    expect(screen.getByRole('button', { name: UPLOAD_BUTTON }).parentElement).toBe(download.parentElement);
  });

  it('is hidden for a customer-portal session', async () => {
    mockSession('portal');
    renderPage();

    expect(await screen.findByText(EMPTY_LIST_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: UPLOAD_BUTTON })).not.toBeInTheDocument();
  });

  it('acknowledges a picked file without sending anything yet', async () => {
    const user = userEvent.setup();
    mockSession();
    const { container } = renderPage();
    await screen.findByText(EMPTY_LIST_TEXT);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(['%PDF'], 'so-1001.pdf', { type: 'application/pdf' }));

    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('so-1001.pdf'));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
