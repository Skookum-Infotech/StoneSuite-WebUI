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
vi.mock('@/services/documentService', () => ({
  documentService: { sendToCustomer: vi.fn(), listSends: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/crm/CrmSubTabsPanel', () => ({ FilesContent: () => null }));
// Stands in for the real dialog: while open it offers one button that reports a
// successful send, the way the dialog's own Send does.
vi.mock('@/components/tenant/SendToCustomerDialog', () => ({
  SendToCustomerDialog: ({ open, onSent }: { open: boolean; onSent: (r: { sentTo: string[] }) => void }) =>
    open ? <button type="button" onClick={() => onSent({ sentTo: ['ap@acme.test'] })}>Confirm send</button> : null,
}));
vi.mock('./components/InvoiceAuditTab', () => ({ InvoiceAuditTab: () => null }));
vi.mock('./components/InvoiceStatusControl', () => ({ InvoiceStatusControl: () => null }));

import InvoiceDetailPage from './InvoiceDetailPage';
import { invoiceService } from '@/services/invoiceService';
import { lookupService } from '@/services/lookupService';
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

  const view = render(
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
  return view;
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

describe('InvoiceDetailPage customer link', () => {
  it('links the sidebar customer to the customer page', async () => {
    vi.mocked(invoiceService.getInvoice).mockResolvedValue(invoice());
    renderPage();

    const links = await screen.findAllByRole('link', { name: 'View customer Acme Stoneworks' });
    for (const link of links) expect(link).toHaveAttribute('href', '/crm/customer/cust-1');
  });
});

describe('InvoiceDetailPage address flags', () => {
  const GEO_LOOKUPS = {
    currencies: [],
    paymentTerms: [],
    priceLevels: [],
    countries: [{ id: 1, code: 'US', name: 'United States' }],
    states: [{ id: 10, code: 'AR', name: 'Arkansas', countryId: 1 }],
  };

  it('shows the state and country flags in the billing address', async () => {
    vi.mocked(lookupService.getCrmLookups).mockResolvedValue(GEO_LOOKUPS as never);
    vi.mocked(invoiceService.getInvoice).mockResolvedValue(invoice({
      billing: { addrLine1: '1 Quarry Rd', stateId: 10, countryId: 1 },
    }));
    const { container } = renderPage();

    expect(await screen.findByText('Arkansas')).toBeInTheDocument();
    expect(screen.getByText('United States')).toBeInTheDocument();
    expect(container.querySelector('img[src="/flags/states/AR.svg"]')).not.toBeNull();
    expect(container.querySelector('img[data-flag-code="us"]')).not.toBeNull();
  });

  it('shows no geo line when the address has no state or country', async () => {
    vi.mocked(lookupService.getCrmLookups).mockResolvedValue(GEO_LOOKUPS as never);
    vi.mocked(invoiceService.getInvoice).mockResolvedValue(invoice({
      billing: { addrLine1: '1 Quarry Rd' },
    }));
    const { container } = renderPage();

    await screen.findAllByText('INV-000001');
    expect(screen.queryByText('Arkansas')).toBeNull();
    expect(container.querySelector('img[src^="/flags/states/"]')).toBeNull();
  });
});

describe('InvoiceDetailPage send to customer', () => {
  const sendable = (overrides: Partial<Invoice> = {}) => invoice({
    billing: { email: 'ap@acme.test' },
    items: [{ lineNumber: 1, itemName: 'Granite', quantity: 1, unitPrice: 100, discountPercent: 0, taxPercent: 0, lineTotal: 100 }] as Invoice['items'],
    ...overrides,
  });

  it('sends from the header and moves an approved invoice to Sent', async () => {
    vi.mocked(invoiceService.getInvoice).mockResolvedValue(sendable({ status: 'Approved', statusCode: 'APPV', nextStatusCodes: ['SENT', 'VOID'] }));
    vi.mocked(invoiceService.transition).mockResolvedValue(sendable({ status: 'Sent', statusCode: 'SENT' }));
    renderPage();

    await userEvent.click((await screen.findAllByRole('button', { name: 'Send invoice to customer' }))[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm send' }));

    expect(await screen.findByText('Sent to ap@acme.test.')).toBeInTheDocument();
    expect(invoiceService.transition).toHaveBeenCalledWith('inv-1', 'SENT');
  });

  it('resends from Quick Actions without changing an invoice that is already past Sent', async () => {
    vi.mocked(invoiceService.getInvoice).mockResolvedValue(sendable({ status: 'Partially Paid', statusCode: 'PART', nextStatusCodes: ['PAID', 'ODUE', 'VOID'] }));
    renderPage();

    // SalesDetailSidebar renders its children twice (desktop rail + mobile sheet).
    await userEvent.click((await screen.findAllByRole('button', { name: 'Resend invoice email to customer' }))[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm send' }));

    expect(await screen.findByText('Sent to ap@acme.test.')).toBeInTheDocument();
    expect(invoiceService.transition).not.toHaveBeenCalled();
  });

  it('explains what is missing instead of opening the send dialog', async () => {
    vi.mocked(invoiceService.getInvoice).mockResolvedValue(invoice({ statusCode: 'APPV', status: 'Approved' }));
    renderPage();

    await userEvent.click((await screen.findAllByRole('button', { name: 'Send invoice to customer' }))[0]);

    expect(screen.getByRole('alert')).toHaveTextContent('A billing email is required to send this invoice.');
    expect(screen.queryByRole('button', { name: 'Confirm send' })).not.toBeInTheDocument();
  });
});
