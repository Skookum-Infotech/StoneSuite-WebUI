import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Invoice } from '@/types/invoice';
import type { Payment } from '@/types/payment';

const permissionMocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  isWorkflowEnabled: vi.fn(),
}));

vi.mock('@/services/paymentService', () => ({
  paymentService: { createPayment: vi.fn() },
}));
vi.mock('@/services/invoiceService', () => ({
  invoiceService: { getInvoice: vi.fn(), searchInvoices: vi.fn() },
}));
vi.mock('@/services/lookupService', () => ({
  lookupService: { getCrmLookups: vi.fn() },
}));
vi.mock('@/services/tenantServices', () => ({
  workflowService: { list: vi.fn(), get: vi.fn() },
}));
vi.mock('@/hooks/useRecordCreateReturn', () => ({
  useRecordCreateReturn: () => ({
    restored: null,
    isRestored: false,
    createdRef: null,
    consumeCreated: vi.fn(),
    provide: () => ({}),
  }),
}));
vi.mock('@/components/crm/CrmSubTabsPanel', async () => {
  const React = await import('react');
  return {
    EditableFilesPanel: React.forwardRef(function EditableFilesPanel(_props, ref) {
      React.useImperativeHandle(ref, () => ({
        hasStagedFiles: () => false,
        uploadStagedTo: vi.fn(),
      }));
      return null;
    }),
  };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
vi.mock('@/hooks/useScrollToError', () => ({
  useScrollToError: () => null,
}));
vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: () => ({
    hasPermission: permissionMocks.hasPermission,
    isLoading: false,
  }),
}));
vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflows: () => ({
    isWorkflowEnabled: permissionMocks.isWorkflowEnabled,
    isLoading: false,
  }),
}));

import AddPaymentPage from './AddPaymentPage';
import { invoiceService } from '@/services/invoiceService';
import { lookupService } from '@/services/lookupService';
import { paymentService } from '@/services/paymentService';
import { workflowService } from '@/services/tenantServices';

function sourceInvoice(): Invoice {
  return {
    id: 'inv-1',
    invoiceNumber: 'INV-000001',
    status: 'Sent',
    statusCode: 'SENT',
    approvalStatus: 'none',
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
    currencyId: 2,
    exchangeRate: 1,
    salesTaxPercent: 0,
    subtotal: 125.5,
    discountTotal: 0,
    taxTotal: 0,
    shippingCharge: 0,
    adjustment: 0,
    grandTotal: 125.5,
    amountPaid: 0,
    balanceDue: 125.5,
    shipSameAsBilling: true,
    billing: {},
    shipping: {},
    items: [],
  };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="location">{location.pathname}{location.search}</div>
      <div data-testid="location-state">{JSON.stringify(location.state)}</div>
    </>
  );
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/sales/payment/new?fromInvoice=inv-1']}>
        <Routes>
          <Route path="/sales/payment/new" element={<AddPaymentPage />} />
          <Route path="/sales/invoice/:id" element={<LocationProbe />} />
          <Route path="/sales/credit_memo/new" element={<LocationProbe />} />
          <Route path="/sales/payment" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  permissionMocks.hasPermission.mockReturnValue(true);
  permissionMocks.isWorkflowEnabled.mockReturnValue(true);
  vi.mocked(invoiceService.getInvoice).mockResolvedValue(sourceInvoice());
  vi.mocked(invoiceService.searchInvoices).mockResolvedValue({
    records: [sourceInvoice()],
    nextCursor: '',
    hasMore: false,
    scope: 'all',
  });
  vi.mocked(lookupService.getCrmLookups).mockResolvedValue({
    currencies: [{ id: 2, code: 'CAD', name: 'Canadian Dollar' }],
    crmStatuses: [{ id: 1, code: 'ACTV', name: 'Active' }],
  } as Awaited<ReturnType<typeof lookupService.getCrmLookups>>);
  vi.mocked(workflowService.list).mockResolvedValue([]);
  vi.mocked(paymentService.createPayment).mockResolvedValue({ id: 'pay-1' } as Payment);
});

describe('AddPaymentPage from invoice', () => {
  it('prefills invoice details and requires a manual application amount', async () => {
    renderPage();

    expect((await screen.findAllByText('For invoice INV-000001')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Acme Stoneworks')).toBeInTheDocument();
    expect(screen.getByLabelText('Currency')).toHaveValue('2');
    expect(screen.getByLabelText('Amount')).toHaveValue(125.5);
    expect(await screen.findByLabelText('Change invoice')).toBeInTheDocument();

    const applicationAmount = screen.getByLabelText('Application amount');
    expect((applicationAmount as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('button', { name: /^Remove application/ })).not.toBeInTheDocument();

    await userEvent.type(applicationAmount, '50');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('CA$50.00')).toBeInTheDocument();

    const paymentAmount = screen.getByLabelText('Amount');
    await userEvent.clear(paymentAmount);
    await userEvent.type(paymentAmount, '60');
    await waitFor(() => expect(paymentAmount).toHaveValue(60));

    await userEvent.selectOptions(screen.getByLabelText('Payment Method'), '3');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save Payment' })[0]);

    await waitFor(() => expect(paymentService.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      customerUuid: 'cust-1',
      methodId: 3,
      currencyId: 2,
      amount: 60,
      applications: [{ invoiceUuid: 'inv-1', amount: 50 }],
    })));
    expect(await screen.findByTestId('location')).toHaveTextContent('/sales/invoice/inv-1');
  });

  it('warns when the payment amount exceeds the invoice balance and caps the application', async () => {
    vi.mocked(paymentService.createPayment).mockResolvedValue({
      id: 'pay-1',
      paymentNumber: 'PAY-000001',
      currencyId: 2,
      unappliedAmount: 30,
    } as Payment);
    renderPage();

    expect((await screen.findAllByText('For invoice INV-000001')).length).toBeGreaterThan(0);
    const paymentAmount = screen.getByLabelText('Amount');
    await userEvent.clear(paymentAmount);
    await userEvent.type(paymentAmount, '150');
    await userEvent.type(screen.getByLabelText('Application amount'), '150');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.selectOptions(screen.getByLabelText('Payment Method'), '3');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save Payment' })[0]);

    const dialog = await screen.findByRole('dialog', { name: 'Payment exceeds invoice balance' });
    expect(dialog).toHaveTextContent('CA$150.00');
    expect(dialog).toHaveTextContent('CA$125.50');
    expect(dialog).toHaveTextContent('CA$24.50');
    expect(paymentService.createPayment).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {
      name: 'Yes, save the payment and continue to a credit memo',
    }));

    await waitFor(() => expect(paymentService.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      amount: 150,
      applications: [{ invoiceUuid: 'inv-1', amount: 125.5 }],
    })));
    expect(await screen.findByTestId('location')).toHaveTextContent('/sales/credit_memo/new');
    expect(screen.getByTestId('location-state')).toHaveTextContent('"invoices":[{"id":"inv-1","number":"INV-000001"}]');
    expect(screen.getByTestId('location-state')).toHaveTextContent('"number":"PAY-000001"');
    expect(screen.getByTestId('location-state')).toHaveTextContent('"currencyId":2');
    expect(screen.getByTestId('location-state')).toHaveTextContent('"currencyCode":"CAD"');
    // Excess is 24.50; the server's larger unapplied figure (30) must not win.
    expect(screen.getByTestId('location-state')).toHaveTextContent('"unappliedAmount":24.5');
  });

  it('warns when the application is within the balance but the payment amount is larger', async () => {
    vi.mocked(paymentService.createPayment).mockResolvedValue({
      id: 'pay-1',
      paymentNumber: 'PAY-000001',
      currencyId: 2,
      unappliedAmount: 74.5,
    } as Payment);
    renderPage();

    expect((await screen.findAllByText('For invoice INV-000001')).length).toBeGreaterThan(0);
    const paymentAmount = screen.getByLabelText('Amount');
    await userEvent.clear(paymentAmount);
    await userEvent.type(paymentAmount, '200');
    await userEvent.type(screen.getByLabelText('Application amount'), '125.5');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.selectOptions(screen.getByLabelText('Payment Method'), '3');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save Payment' })[0]);

    const dialog = await screen.findByRole('dialog', { name: 'Payment exceeds invoice balance' });
    expect(dialog).toHaveTextContent('CA$74.50');
    await userEvent.click(screen.getByRole('button', {
      name: 'Yes, save the payment and continue to a credit memo',
    }));

    await waitFor(() => expect(paymentService.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      amount: 200,
      applications: [{ invoiceUuid: 'inv-1', amount: 125.5 }],
    })));
    expect(await screen.findByTestId('location')).toHaveTextContent('/sales/credit_memo/new');
    expect(screen.getByTestId('location-state')).toHaveTextContent('"unappliedAmount":74.5');
  });

  it('does not warn when the payment amount matches the invoice balance', async () => {
    renderPage();

    expect((await screen.findAllByText('For invoice INV-000001')).length).toBeGreaterThan(0);
    await userEvent.type(screen.getByLabelText('Application amount'), '125.5');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.selectOptions(screen.getByLabelText('Payment Method'), '3');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save Payment' })[0]);

    await waitFor(() => expect(paymentService.createPayment).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks for a correct amount when the excess is rejected and saves once it is fixed', async () => {
    renderPage();

    expect((await screen.findAllByText('For invoice INV-000001')).length).toBeGreaterThan(0);
    const paymentAmount = screen.getByLabelText('Amount');
    await userEvent.clear(paymentAmount);
    await userEvent.type(paymentAmount, '200');
    await userEvent.type(screen.getByLabelText('Application amount'), '125.5');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.selectOptions(screen.getByLabelText('Payment Method'), '3');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save Payment' })[0]);

    await userEvent.click(await screen.findByRole('button', { name: 'No, enter a correct amount' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(paymentService.createPayment).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('cannot exceed the invoice balance of CA$125.50');
    expect(paymentAmount).toHaveFocus();
    expect(paymentAmount).toHaveAttribute('aria-invalid', 'true');

    // Saving again without fixing the amount asks again — the payment is blocked.
    await userEvent.click(screen.getAllByRole('button', { name: 'Save Payment' })[0]);
    await userEvent.click(await screen.findByRole('button', { name: 'No, enter a correct amount' }));
    expect(paymentService.createPayment).not.toHaveBeenCalled();

    await userEvent.clear(paymentAmount);
    await userEvent.type(paymentAmount, '125.5');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(paymentAmount).not.toHaveAttribute('aria-invalid', 'true');

    await userEvent.click(screen.getAllByRole('button', { name: 'Save Payment' })[0]);
    await waitFor(() => expect(paymentService.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      amount: 125.5,
      applications: [{ invoiceUuid: 'inv-1', amount: 125.5 }],
    })));
    expect(await screen.findByTestId('location')).toHaveTextContent('/sales/invoice/inv-1');
  });

  it('flags both the amount and the over-balance application when the excess is rejected', async () => {
    renderPage();

    expect((await screen.findAllByText('For invoice INV-000001')).length).toBeGreaterThan(0);
    const paymentAmount = screen.getByLabelText('Amount');
    await userEvent.clear(paymentAmount);
    await userEvent.type(paymentAmount, '150');
    await userEvent.type(screen.getByLabelText('Application amount'), '150');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.selectOptions(screen.getByLabelText('Payment Method'), '3');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save Payment' })[0]);
    await userEvent.click(await screen.findByRole('button', { name: 'No, enter a correct amount' }));

    const alerts = screen.getAllByRole('alert').map((alert) => alert.textContent);
    expect(alerts).toEqual(expect.arrayContaining([
      expect.stringContaining('Payment amount cannot exceed the invoice balance of CA$125.50'),
      expect.stringContaining('Application amount for INV-000001 cannot exceed CA$125.50'),
    ]));
    expect(screen.getByLabelText('Application amount')).toHaveValue(125.5);
    expect(paymentService.createPayment).not.toHaveBeenCalled();
  });

  it('offers the credit memo when only the application amount is raised above the balance', async () => {
    vi.mocked(paymentService.createPayment).mockResolvedValue({
      id: 'pay-1',
      paymentNumber: 'PAY-000001',
      currencyId: 2,
      unappliedAmount: 24.5,
    } as Payment);
    renderPage();

    expect((await screen.findAllByText('For invoice INV-000001')).length).toBeGreaterThan(0);
    // The Payment Amount stays at the prefilled balance (125.50); only the row is raised.
    await userEvent.type(screen.getByLabelText('Application amount'), '150');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.selectOptions(screen.getByLabelText('Payment Method'), '3');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save Payment' })[0]);

    const dialog = await screen.findByRole('dialog', { name: 'Payment exceeds invoice balance' });
    expect(dialog).toHaveTextContent('CA$150.00');
    expect(dialog).toHaveTextContent('CA$24.50');
    expect(paymentService.createPayment).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {
      name: 'Yes, save the payment and continue to a credit memo',
    }));

    // The payment is saved as the amount that was entered, applied only up to the balance.
    await waitFor(() => expect(paymentService.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      amount: 150,
      applications: [{ invoiceUuid: 'inv-1', amount: 125.5 }],
    })));
    expect(await screen.findByTestId('location')).toHaveTextContent('/sales/credit_memo/new');
    expect(screen.getByTestId('location-state')).toHaveTextContent('"unappliedAmount":24.5');
  });

  it('only sends the application back on No when the payment amount itself is fine', async () => {
    renderPage();

    expect((await screen.findAllByText('For invoice INV-000001')).length).toBeGreaterThan(0);
    await userEvent.type(screen.getByLabelText('Application amount'), '150');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.selectOptions(screen.getByLabelText('Payment Method'), '3');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save Payment' })[0]);
    await userEvent.click(await screen.findByRole('button', { name: 'No, enter a correct amount' }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent('Application amount for INV-000001 cannot exceed CA$125.50');
    expect(screen.getByLabelText('Amount')).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Application amount')).toHaveValue(125.5);
    expect(paymentService.createPayment).not.toHaveBeenCalled();
  });

  it('warns about a bigger payment amount even when the invoice was never added as a row', async () => {
    vi.mocked(paymentService.createPayment).mockResolvedValue({
      id: 'pay-1',
      paymentNumber: 'PAY-000001',
      currencyId: 2,
      unappliedAmount: 74.5,
    } as Payment);
    renderPage();

    expect((await screen.findAllByText('For invoice INV-000001')).length).toBeGreaterThan(0);
    const paymentAmount = screen.getByLabelText('Amount');
    await userEvent.clear(paymentAmount);
    await userEvent.type(paymentAmount, '200');
    await userEvent.selectOptions(screen.getByLabelText('Payment Method'), '3');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save Payment' })[0]);

    const dialog = await screen.findByRole('dialog', { name: 'Payment exceeds invoice balance' });
    expect(dialog).toHaveTextContent('CA$74.50');
    await userEvent.click(screen.getByRole('button', {
      name: 'Yes, save the payment and continue to a credit memo',
    }));

    // The selected invoice is paid up to its balance; the rest goes to the credit memo.
    await waitFor(() => expect(paymentService.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      amount: 200,
      applications: [{ invoiceUuid: 'inv-1', amount: 125.5 }],
    })));
    expect(await screen.findByTestId('location')).toHaveTextContent('/sales/credit_memo/new');
    expect(screen.getByTestId('location-state')).toHaveTextContent('"unappliedAmount":74.5');
  });

  it('asks for a correct amount on No when the invoice was never added as a row', async () => {
    renderPage();

    expect((await screen.findAllByText('For invoice INV-000001')).length).toBeGreaterThan(0);
    const paymentAmount = screen.getByLabelText('Amount');
    await userEvent.clear(paymentAmount);
    await userEvent.type(paymentAmount, '200');
    await userEvent.selectOptions(screen.getByLabelText('Payment Method'), '3');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save Payment' })[0]);
    await userEvent.click(await screen.findByRole('button', { name: 'No, enter a correct amount' }));

    expect(screen.getByRole('alert')).toHaveTextContent('cannot exceed the invoice balance of CA$125.50');
    expect(paymentAmount).toHaveFocus();
    expect(paymentService.createPayment).not.toHaveBeenCalled();
  });

  it('blocks the credit memo handoff when the permission is unavailable', async () => {
    permissionMocks.hasPermission.mockReturnValue(false);
    renderPage();

    expect((await screen.findAllByText('For invoice INV-000001')).length).toBeGreaterThan(0);
    const paymentAmount = screen.getByLabelText('Amount');
    await userEvent.clear(paymentAmount);
    await userEvent.type(paymentAmount, '200');
    await userEvent.type(screen.getByLabelText('Application amount'), '125.5');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.selectOptions(screen.getByLabelText('Payment Method'), '3');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save Payment' })[0]);

    expect(await screen.findByRole('button', {
      name: 'Yes, save the payment and continue to a credit memo',
    })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('You do not have permission to create Credit Memos');
    await userEvent.click(screen.getByRole('button', { name: 'No, enter a correct amount' }));
    expect(paymentService.createPayment).not.toHaveBeenCalled();
  });

  it('revalidates the source invoice before creating the payment', async () => {
    const paidInvoice = {
      ...sourceInvoice(),
      status: 'Paid',
      statusCode: 'PAID',
      amountPaid: 125.5,
      balanceDue: 0,
    };
    vi.mocked(invoiceService.getInvoice)
      .mockResolvedValueOnce(sourceInvoice())
      .mockResolvedValueOnce(paidInvoice);
    renderPage();

    expect((await screen.findAllByText('For invoice INV-000001')).length).toBeGreaterThan(0);
    const paymentAmount = screen.getByLabelText('Amount');
    await userEvent.clear(paymentAmount);
    await userEvent.type(paymentAmount, '150');
    await userEvent.type(screen.getByLabelText('Application amount'), '150');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.selectOptions(screen.getByLabelText('Payment Method'), '3');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save Payment' })[0]);
    await userEvent.click(await screen.findByRole('button', {
      name: 'Yes, save the payment and continue to a credit memo',
    }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The source invoice is no longer eligible for payment. Remove it or return to the invoice.');
    expect(paymentService.createPayment).not.toHaveBeenCalled();
  });
});
