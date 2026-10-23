import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/services/salesOrderService', () => ({
  salesOrderService: {
    getOrder: vi.fn(),
    transition: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    convertToInvoice: vi.fn(),
    getCustomerOrderForm: vi.fn(),
  },
}));
vi.mock('@/services/fabricationService', () => ({ fabricationService: { fabricateFromOrder: vi.fn() } }));
vi.mock('@/services/lookupService', () => ({
  lookupService: {
    getCrmLookups: vi.fn().mockResolvedValue({ currencies: [], paymentTerms: [], priceLevels: [] }),
  },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/store/useAuthStore', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  isPortalSession: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/crm/CrmSubTabsPanel', () => ({ FilesContent: () => null }));
vi.mock('@/components/tenant/SendToCustomerDialog', () => ({ SendToCustomerDialog: () => null }));
vi.mock('@/components/tenant/DocumentSendHistory', () => ({ DocumentSendHistory: () => null }));
vi.mock('./components/SalesOrderInventoryTab', () => ({ SalesOrderInventoryTab: () => null }));
vi.mock('./components/SalesOrderAuditTab', () => ({ SalesOrderAuditTab: () => null }));
vi.mock('./components/SalesOrderStatusControl', () => ({ SalesOrderStatusControl: () => null }));
vi.mock('@/components/tenant/RecordCommunicationTab', () => ({
  RecordCommunicationTab: ({ recordId }: { recordId: string }) => <div>Communication tab for {recordId}</div>,
}));
vi.mock('./components/SalesOrderSchedulingTab', () => ({
  SalesOrderSchedulingTab: ({ orderId }: { orderId: string }) => <div>Scheduling tab for {orderId}</div>,
}));

import SalesOrderDetailPage from './SalesOrderDetailPage';
import { salesOrderService } from '@/services/salesOrderService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { isPortalSession } from '@/store/useAuthStore';
import type { SalesOrder } from '@/types/salesOrder';

function order(overrides: Partial<SalesOrder> = {}): SalesOrder {
  return {
    id: 'so-1',
    salesOrderNumber: 'SO-1042',
    status: 'Open',
    statusCode: 'OPEN',
    approvalStatus: 'none',
    nextStatusCodes: [],
    gated: false,
    approvers: [],
    requiredApprovals: 0,
    approvedCount: 0,
    canApprove: false,
    isOverride: false,
    callerAlreadyApproved: false,
    customer: { id: 'cust-1', name: 'Acme Stoneworks' },
    orderDate: '2026-10-01',
    scheduledInstallDate: '2026-11-10',
    paymentTermsId: null,
    priceLevelId: null,
    currencyId: null,
    salesRepEmployeeId: null,
    ownerEmployeeId: null,
    salesTaxPercent: 0,
    shipSameAsBilling: true,
    billing: {},
    shipping: {},
    subtotal: 100,
    discountTotal: 0,
    taxTotal: 0,
    shippingCharge: 0,
    adjustment: 0,
    grandTotal: 100,
    items: [],
    ...overrides,
  };
}

function renderPage(search = '') {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '',
    isSuperAdmin: false,
    hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/sales/sales_order/so-1${search}`]}>
        <Routes>
          <Route path="/sales/sales_order/:id" element={<SalesOrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isPortalSession).mockReturnValue(false);
  vi.mocked(salesOrderService.getOrder).mockResolvedValue(order());
  // Not placed from the portal: no Customer Order Form action.
  vi.mocked(salesOrderService.getCustomerOrderForm).mockResolvedValue(null);
});

describe('SalesOrderDetailPage ?tab=', () => {
  it('opens on Overview by default', async () => {
    renderPage();

    expect(await screen.findByText('Primary Information')).toBeInTheDocument();
    expect(screen.queryByText('Scheduling tab for so-1')).toBeNull();
  });

  // The Activity Planner's job cards link here.
  it('opens the Scheduling tab when the link asks for it', async () => {
    renderPage('?tab=scheduling');

    expect(await screen.findByText('Scheduling tab for so-1')).toBeInTheDocument();
    expect(screen.queryByText('Primary Information')).toBeNull();
  });

  it('shows the Scheduled Installation Date on the Overview', async () => {
    renderPage();

    expect(await screen.findByText('Scheduled Installation Date')).toBeInTheDocument();
  });

  it('falls back to Overview for a tab it does not have', async () => {
    renderPage('?tab=nonsense');

    expect(await screen.findByText('Primary Information')).toBeInTheDocument();
  });

  it('shows the Items tab with a kit heading above the lines that came from a kit', async () => {
    const line = (id: string, itemName: string, kit?: { kitId: string; kitName: string }) => ({
      id, lineNumber: 1, itemName, sku: id, description: '', unitCode: '', quantity: 1, unitPrice: 10,
      discountPercent: 0, taxPercent: 0, lineSubtotal: 10, lineDiscount: 0, lineTax: 0, lineTotal: 10,
      fulfilledQuantity: 0, status: 'open' as const, ...kit,
    });
    vi.mocked(salesOrderService.getOrder).mockResolvedValue(order({
      items: [
        line('l1', 'Loose Slab'),
        line('l2', 'Countertop', { kitId: 'k1', kitName: 'Kitchen' }),
        line('l3', 'Sink', { kitId: 'k1', kitName: 'Kitchen' }),
      ],
    }));
    renderPage('?tab=items');

    const heading = await screen.findByRole('row', { name: 'Kit Kitchen' });
    expect(heading).toHaveTextContent('2 items');
    const rows = screen.getAllByRole('row').map((r) => r.getAttribute('aria-label') ?? r.textContent ?? '');
    expect(rows.findIndex((r) => r === 'Kit Kitchen')).toBeGreaterThan(rows.findIndex((r) => r.includes('Loose Slab')));
    // Read-only here: a heading you cannot remove from the detail page.
    expect(screen.queryByRole('button', { name: /Remove kit Kitchen/ })).not.toBeInTheDocument();
  });

  it('opens the Communication tab when the link asks for it', async () => {
    renderPage('?tab=communication');

    expect(await screen.findByText('Communication tab for so-1')).toBeInTheDocument();
    expect(screen.queryByText('Primary Information')).toBeNull();
  });

  it('never opens the staff-only Communication tab for a customer session', async () => {
    vi.mocked(isPortalSession).mockReturnValue(true);
    renderPage('?tab=communication');

    expect(await screen.findByText('Primary Information')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Communication' })).toBeNull();
    expect(screen.queryByText('Communication tab for so-1')).toBeNull();
  });

  it('never opens the staff-only Scheduling tab for a customer session', async () => {
    vi.mocked(isPortalSession).mockReturnValue(true);
    renderPage('?tab=scheduling');

    expect(await screen.findByText('Primary Information')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Scheduling' })).toBeNull();
    expect(screen.queryByText('Scheduling tab for so-1')).toBeNull();
  });
});
