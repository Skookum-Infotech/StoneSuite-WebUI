import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Payment } from '@/types/payment';

vi.mock('@/services/paymentService', () => ({
  paymentService: { getPayment: vi.fn(), approve: vi.fn(), reject: vi.fn(), transition: vi.fn() },
}));
vi.mock('@/services/lookupService', () => ({
  lookupService: { getCrmLookups: vi.fn().mockResolvedValue({ currencies: [] }) },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
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

function renderPage() {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/sales/payment/pay-1']}>
        <Routes>
          <Route path="/sales/payment/:id" element={<PaymentDetailPage />} />
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
