import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Payment } from '@/types/payment';

const workflowMocks = vi.hoisted(() => ({ isWorkflowEnabled: vi.fn() }));

vi.mock('@/services/paymentService', () => ({
  paymentService: { getPayment: vi.fn(), approve: vi.fn(), reject: vi.fn(), transition: vi.fn() },
}));
vi.mock('@/services/lookupService', () => ({
  lookupService: {
    getCrmLookups: vi.fn().mockResolvedValue({ currencies: [{ id: 2, code: 'CAD', name: 'Canadian Dollar' }] }),
  },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflows: () => ({ isWorkflowEnabled: workflowMocks.isWorkflowEnabled, isLoading: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PaymentDetailPage from './PaymentDetailPage';
import { paymentService } from '@/services/paymentService';
import { useUserPermissions } from '@/hooks/useUserPermissions';

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1', paymentNumber: 'PAY-000001', status: 'Approved', statusCode: 'APPV',
    approvalStatus: 'none', gated: false, approvers: [], requiredApprovals: 0, approvedCount: 0,
    canApprove: false, isOverride: false, callerAlreadyApproved: false,
    customer: { id: 'cust-1', name: 'Acme Stoneworks' }, methodId: 3, method: 'Check',
    referenceNumber: '', paymentDate: '2026-09-01', memo: '', internalNotes: '',
    amount: 500, appliedTotal: 0, unappliedAmount: 500, applications: [], customFields: {},
    createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', recordVersion: 1,
    ...overrides,
  } as Payment;
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="location">{location.pathname}</div>
      <div data-testid="location-state">{JSON.stringify(location.state)}</div>
    </>
  );
}

interface RenderOptions {
  canCreateCreditMemo?: boolean;
  creditMemoWorkflowEnabled?: boolean;
}

function renderPage({ canCreateCreditMemo = true, creditMemoWorkflowEnabled = true }: RenderOptions = {}) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string) => resource !== 'credit_memo' || canCreateCreditMemo,
  } as ReturnType<typeof useUserPermissions>);
  workflowMocks.isWorkflowEnabled.mockReturnValue(creditMemoWorkflowEnabled);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/sales/payment/pay-1']}>
        <Routes>
          <Route path="/sales/payment/:id" element={<PaymentDetailPage />} />
          <Route path="/sales/credit_memo/new" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('PaymentDetailPage credited overpayment', () => {
  it('shows what was credited to credit memos and what is still free to apply', async () => {
    vi.mocked(paymentService.getPayment).mockResolvedValue(payment({ creditedTotal: 200 }));
    renderPage();

    expect(await screen.findByText('Credited to credit memos')).toBeInTheDocument();
    expect(screen.getByText('Available to apply')).toBeInTheDocument();
    expect(screen.getByText('$300.00')).toBeInTheDocument();
  });

  it('shows neither line when nothing was credited', async () => {
    vi.mocked(paymentService.getPayment).mockResolvedValue(payment());
    renderPage();

    expect(await screen.findAllByText('PAY-000001')).not.toHaveLength(0);
    expect(screen.queryByText('Credited to credit memos')).not.toBeInTheDocument();
    expect(screen.queryByText('Available to apply')).not.toBeInTheDocument();
  });

  it('cannot apply money that is all credited already', async () => {
    vi.mocked(paymentService.getPayment).mockResolvedValue(payment({ creditedTotal: 500 }));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Applications' }));

    expect(screen.getByRole('button', { name: 'Apply to invoice' })).toBeDisabled();
  });

  it('can still apply the part that is not credited', async () => {
    vi.mocked(paymentService.getPayment).mockResolvedValue(payment({ creditedTotal: 200 }));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Applications' }));

    expect(screen.getByRole('button', { name: 'Apply to invoice' })).toBeEnabled();
  });
});

// A payment saved with an excess whose credit memo was cancelled: the excess is
// still unapplied on the payment, and the payment page can raise that memo again.
describe('PaymentDetailPage create credit memo', () => {
  const appliedToInvoice = [
    { id: 'app-1', invoiceId: 'inv-6', invoiceNumber: 'INVC-000006', amount: 700, createdAt: '2026-09-01T00:00:00Z' },
  ];
  const withExcess = (overrides: Partial<Payment> = {}) => payment({
    amount: 1000, appliedTotal: 700, unappliedAmount: 300, currencyId: 2, applications: appliedToInvoice, ...overrides,
  });
  // SalesDetailSidebar renders its children twice (desktop rail + mobile sheet).
  const createButtons = () => screen.queryAllByRole('button', { name: 'Create credit memo' });

  it('opens the credit memo form prefilled from the payment', async () => {
    vi.mocked(paymentService.getPayment).mockResolvedValue(withExcess());
    renderPage();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Create credit memo' }))[0]);

    expect(await screen.findByTestId('location')).toHaveTextContent('/sales/credit_memo/new');
    expect(JSON.parse(screen.getByTestId('location-state').textContent ?? '')).toEqual({
      creditMemoFromPayment: {
        customer: { id: 'cust-1', name: 'Acme Stoneworks' },
        invoices: [{ id: 'inv-6', number: 'INVC-000006' }],
        payment: { id: 'pay-1', number: 'PAY-000001' },
        currencyId: 2,
        currencyCode: 'CAD',
        unappliedAmount: 300,
      },
    });
  });

  it('offers only what earlier credit memos have not already taken', async () => {
    vi.mocked(paymentService.getPayment).mockResolvedValue(withExcess({ creditedTotal: 277.24 }));
    renderPage();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Create credit memo' }))[0]);

    expect(JSON.parse(screen.getByTestId('location-state').textContent ?? '').creditMemoFromPayment.unappliedAmount)
      .toBe(22.76);
  });

  it.each([
    ['there is no unapplied balance', { unappliedAmount: 0 }],
    ['all of it is already credited', { creditedTotal: 300 }],
    ['it was applied to no invoice', { applications: [] }],
    ['the payment is voided', { status: 'Void', statusCode: 'VOID' }],
  ])('is not offered when %s', async (_label, overrides) => {
    vi.mocked(paymentService.getPayment).mockResolvedValue(withExcess(overrides));
    renderPage();

    expect((await screen.findAllByText('PAY-000001')).length).toBeGreaterThan(0);
    expect(createButtons()).toHaveLength(0);
  });

  it('is not offered without permission to create credit memos', async () => {
    vi.mocked(paymentService.getPayment).mockResolvedValue(withExcess());
    renderPage({ canCreateCreditMemo: false });

    expect((await screen.findAllByText('PAY-000001')).length).toBeGreaterThan(0);
    expect(createButtons()).toHaveLength(0);
  });

  it('is not offered when the credit memo workflow is disabled', async () => {
    vi.mocked(paymentService.getPayment).mockResolvedValue(withExcess());
    renderPage({ creditMemoWorkflowEnabled: false });

    expect((await screen.findAllByText('PAY-000001')).length).toBeGreaterThan(0);
    expect(createButtons()).toHaveLength(0);
  });
});
