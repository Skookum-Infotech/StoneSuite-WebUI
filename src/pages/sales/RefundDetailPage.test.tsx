import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/services/refundService', () => ({
  refundService: { getRefund: vi.fn(), approve: vi.fn(), reject: vi.fn(), transition: vi.fn() },
}));
vi.mock('@/services/lookupService', () => ({
  lookupService: { getCurrencies: vi.fn().mockResolvedValue([]), getCurrency: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import RefundDetailPage from './RefundDetailPage';
import { refundService } from '@/services/refundService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { toast } from 'sonner';
import type { Refund } from '@/types/refund';

// A refund on its approval gate. A Refund's gate is its very first status
// (Pending), so a rejection cannot send it anywhere earlier: it stays Pending,
// still gated, flagged rejected until it is edited.
const pendingRefund = {
  id: 'rf-1',
  refundNumber: 'RFND-000001',
  status: 'Pending',
  statusCode: 'PEND',
  nextStatusCodes: ['VOID'],
  gated: true,
  approvers: [{ id: 'a1', name: 'Alice Approver', approved: false }],
  requiredApprovals: 1,
  approvedCount: 0,
  canApprove: true,
  isOverride: false,
  callerAlreadyApproved: false,
  canReject: true,
  customer: { id: 'c1', name: 'Acme Stoneworks' },
  method: 'Check',
  amount: 500,
  appliedTotal: 0,
  unappliedAmount: 500,
  applications: [],
  refundDate: '2026-09-01',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
} as unknown as Refund;

function renderPage() {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '',
    hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/sales/refund/rf-1']}>
        <Routes>
          <Route path="/sales/refund/:id" element={<RefundDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('RefundDetailPage — approver Reject', () => {
  it('lets an approver reject with a reason, then refetches and tells them to edit it', async () => {
    vi.mocked(refundService.getRefund).mockResolvedValue(pendingRefund);
    vi.mocked(refundService.reject).mockResolvedValue(pendingRefund);
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Reject this refund' }));
    await user.type(screen.getByRole('textbox', { name: 'Rejection reason' }), 'Customer has an open balance');
    await user.click(screen.getByRole('button', { name: 'Reject refund' }));

    await waitFor(() => expect(refundService.reject).toHaveBeenCalledWith('rf-1', 'Customer has an open balance'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Rejected — edit it to resubmit for approval.'));
    await waitFor(() => expect(vi.mocked(refundService.getRefund).mock.calls.length).toBeGreaterThan(1));
  });

  it('shows a refund rejected in place with the edit wording and no Approve or Reject', async () => {
    vi.mocked(refundService.getRefund).mockResolvedValue({
      ...pendingRefund,
      canApprove: false, canReject: false,
      rejection: { byName: 'Alice Approver', reason: 'Customer has an open balance', at: '2026-09-19T10:00:00Z' },
    });
    renderPage();

    expect(await screen.findByText(/Alice Approver: "Customer has an open balance"/)).toBeInTheDocument();
    expect(screen.getByText(/Edit the record to resubmit it for approval/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve this record' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject this refund' })).not.toBeInTheDocument();
  });
});
