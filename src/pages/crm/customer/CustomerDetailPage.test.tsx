import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/crmService', () => ({
  crmService: { getRecord: vi.fn(), getWorkflowStatuses: vi.fn() },
}));
vi.mock('@/services/tenantServices', () => ({
  userService: { listAssignableUsers: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/services/lookupService', () => ({
  lookupService: { getCrmLookups: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/components/crm/CrmRecordDetail', () => ({ CrmRecordDetail: () => <div>Overview body</div> }));
vi.mock('@/components/crm/CrmDetailSidebar', () => ({ CrmDetailSidebar: () => null }));
vi.mock('@/components/crm/CustomerStatusActions', () => ({ CustomerStatusActions: () => null }));
vi.mock('@/components/crm/CrmSubTabsPanel', () => ({
  AuditContent: () => <div>Audit body</div>,
  FilesContent: () => <div>Files body</div>,
}));
vi.mock('@/components/crm/ActivityLogPanel', () => ({ ActivityLogPanel: () => null }));
vi.mock('@/pages/crm/customer/components/PortalAccessPanel', () => ({ PortalAccessPanel: () => null }));
vi.mock('@/pages/crm/customer/components/PortalAccessStatusCard', () => ({ PortalAccessStatusCard: () => null }));
vi.mock('@/pages/crm/customer/components/CustomerDeleteButton', () => ({ CustomerDeleteButton: () => null }));
vi.mock('@/pages/crm/customer/components/transactions/CustomerTransactionsTab', () => ({
  CustomerTransactionsTab: ({ customerId }: { customerId: string }) => <div>Transactions body for {customerId}</div>,
}));

import CustomerDetailPage from './CustomerDetailPage';
import { crmService } from '@/services/crmService';
import { useUserPermissions } from '@/hooks/useUserPermissions';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

function renderPage(entry: string | { pathname: string; search?: string; state?: unknown }) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '',
    isSuperAdmin: false,
    hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
  vi.mocked(crmService.getRecord).mockResolvedValue({
    id: 'cust-1',
    recordNumber: 'CUST-1',
    currentStateId: 's1',
    ownerUserId: 'u1',
    coreFields: { customer_name: 'Acme Co' },
    customFields: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as unknown as Awaited<ReturnType<typeof crmService.getRecord>>);
  vi.mocked(crmService.getWorkflowStatuses).mockResolvedValue({ statuses: [] } as unknown as Awaited<
    ReturnType<typeof crmService.getWorkflowStatuses>
  >);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
        <Routes>
          <Route path="/crm/customer/:id" element={<CustomerDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('CustomerDetailPage tabs', () => {
  it('defaults to Overview', async () => {
    renderPage('/crm/customer/cust-1');
    expect(await screen.findByText('Overview body')).toBeInTheDocument();
  });

  it('opens the Transactions tab from ?tab=transactions', async () => {
    renderPage('/crm/customer/cust-1?tab=transactions');
    expect(await screen.findByText('Transactions body for cust-1')).toBeInTheDocument();
  });

  it('writes the clicked tab to the URL and keeps other params', async () => {
    renderPage('/crm/customer/cust-1?type=invoice');
    await screen.findByText('Overview body');

    await userEvent.click(screen.getByRole('button', { name: 'Files' }));

    expect(await screen.findByText('Files body')).toBeInTheDocument();
    const loc = screen.getByTestId('location').textContent ?? '';
    expect(loc).toContain('tab=files');
    expect(loc).toContain('type=invoice');
  });

  it('honours location.state.initialTab when ?tab= is absent', async () => {
    renderPage({ pathname: '/crm/customer/cust-1', state: { initialTab: 'audit' } });
    expect(await screen.findByText('Audit body')).toBeInTheDocument();
  });

  it('ignores an unknown ?tab= value', async () => {
    renderPage('/crm/customer/cust-1?tab=bogus');
    expect(await screen.findByText('Overview body')).toBeInTheDocument();
  });
});
