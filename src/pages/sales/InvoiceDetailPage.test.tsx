import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('@/services/invoiceService', () => ({
  invoiceService: {
    getInvoice: vi.fn(),
    transition: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    deleteInvoice: vi.fn(),
  },
}));
vi.mock('@/services/lookupService', () => ({
  lookupService: {
    getCrmLookups: vi.fn().mockResolvedValue({ currencies: [], paymentTerms: [], priceLevels: [] }),
  },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/crm/CrmSubTabsPanel', () => ({ FilesContent: () => null }));
vi.mock('@/components/tenant/SendToCustomerDialog', () => ({ SendToCustomerDialog: () => null }));
vi.mock('./components/InvoiceAuditTab', () => ({ InvoiceAuditTab: () => null }));
vi.mock('./components/InvoiceStatusControl', () => ({ InvoiceStatusControl: () => null }));

import InvoiceDetailPage from './InvoiceDetailPage';
import { invoiceService } from '@/services/invoiceService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { Invoice } from '@/types/invoice';

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1',
    invoiceNumber: 'INV-000001',
    status: 'Draft',
    statusCode: 'DRFT',
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
    invoiceDate: '2026-09-01',
    paymentTermsId: null,
    priceLevelId: null,
    currencyId: null,
    exchangeRate: 1,
    salesTaxPercent: 0,
    subtotal: 100,
    discountTotal: 0,
    taxTotal: 0,
    shippingCharge: 0,
    adjustment: 0,
    grandTotal: 100,
    amountPaid: 0,
    balanceDue: 100,
    shipSameAsBilling: true,
    billing: {},
    shipping: {},
    items: [],
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

function renderPage(hasPermission: (resource: string, action: string) => boolean = () => true) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '',
    isSuperAdmin: false,
    hasPermission,
  } as ReturnType<typeof useUserPermissions>);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/sales/invoice/inv-1']}>
        <Routes>
          <Route path="/sales/invoice/:id" element={<InvoiceDetailPage />} />
          <Route path="/sales/payment/new" element={<LocationProbe />} />
          <Route path="/sales/sales_order/:id" element={<div>Sales Order Detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('InvoiceDetailPage record payment', () => {
  it('opens payment creation from the header with the invoice id', async () => {
    vi.mocked(invoiceService.getInvoice).mockResolvedValue(invoice({
      status: 'Sent',
      statusCode: 'SENT',
    }));
    renderPage();

    const buttons = await screen.findAllByRole('button', {
      name: 'Record payment for invoice INV-000001',
    });
    await userEvent.click(buttons[0]);

    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/sales/payment/new?fromInvoice=inv-1',
    );
  });

  it('hides record payment for a draft invoice', async () => {
    vi.mocked(invoiceService.getInvoice).mockResolvedValue(invoice());
    renderPage();

    await screen.findAllByText('INV-000001');

    expect(screen.queryAllByRole('button', {
      name: 'Record payment for invoice INV-000001',
    })).toHaveLength(0);
  });

  it('hides record payment without payment create permission', async () => {
    vi.mocked(invoiceService.getInvoice).mockResolvedValue(invoice({
      status: 'Sent',
      statusCode: 'SENT',
    }));
    renderPage((resource, action) => !(resource === 'payment' && action === 'create'));

    await screen.findAllByText('INV-000001');

    expect(screen.queryAllByRole('button', {
      name: 'Record payment for invoice INV-000001',
    })).toHaveLength(0);
  });
});

describe('InvoiceDetailPage source sales order', () => {
  it('links a converted invoice to its source sales order', async () => {
    vi.mocked(invoiceService.getInvoice).mockResolvedValue(invoice({
      salesOrder: { id: 'so-42', number: 'SO-000042' },
    }));
    renderPage();

    const sourceLink = await screen.findByRole('link', { name: 'View sales order SO-000042' });

    expect(sourceLink).toHaveTextContent('SO-000042');
    expect(sourceLink).toHaveAttribute('href', '/sales/sales_order/so-42');
  });

  it('does not show a source link for a standalone invoice', async () => {
    vi.mocked(invoiceService.getInvoice).mockResolvedValue(invoice());
    renderPage();

    await screen.findAllByText('INV-000001');

    expect(screen.queryByText('Source Sales Order')).not.toBeInTheDocument();
  });
});
