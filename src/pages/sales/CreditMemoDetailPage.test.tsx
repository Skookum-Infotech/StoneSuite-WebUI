import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { CreditMemo, CreditMemoLine } from '@/types/creditMemo';

vi.mock('@/services/creditMemoService', () => ({
  creditMemoService: { getCreditMemo: vi.fn(), approve: vi.fn(), reject: vi.fn(), unapply: vi.fn() },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import CreditMemoDetailPage from './CreditMemoDetailPage';
import { creditMemoService } from '@/services/creditMemoService';
import { useUserPermissions } from '@/hooks/useUserPermissions';

function memo(overrides: Partial<CreditMemo> = {}): CreditMemo {
  return {
    id: 'cm-1', creditMemoNumber: 'CRDT-000001', status: 'Draft', statusCode: 'DRFT',
    approvalStatus: 'none', gated: false, approvers: [], requiredApprovals: 0, approvedCount: 0,
    canApprove: false, isOverride: false, callerAlreadyApproved: false,
    customer: { id: 'cust-1', name: 'Acme Stoneworks' }, creditMemoDate: '2026-09-01',
    salesTaxPercent: 0, subtotal: 250, discountTotal: 0, taxTotal: 0, adjustment: 0,
    grandTotal: 250, appliedTotal: 0, unappliedAmount: 250, billing: {}, lines: [], applications: [],
    ...overrides,
  };
}

const legacyLine: CreditMemoLine = {
  id: 'l-1', lineNumber: 1, sku: 'SLAB-1', itemName: 'Granite slab', description: '', unitCode: 'ea',
  quantity: 2, unitPrice: 125, discountPercent: 0, taxPercent: 0,
  lineSubtotal: 250, lineDiscount: 0, lineTax: 0, lineTotal: 250,
};

function renderPage() {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/sales/credit_memo/cm-1']}>
        <Routes>
          <Route path="/sales/credit_memo/:id" element={<CreditMemoDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('CreditMemoDetailPage', () => {
  it('links to the payment the memo was issued from', async () => {
    vi.mocked(creditMemoService.getCreditMemo).mockResolvedValue(
      memo({ sourcePayment: { id: 'pay-1', number: 'PAY-000001' } }),
    );
    renderPage();

    const link = await screen.findByRole('link', { name: 'View payment PAY-000001' });
    expect(link).toHaveAttribute('href', '/sales/payment/pay-1');
  });

  it('has no Source Payment for a memo that was not issued from one', async () => {
    vi.mocked(creditMemoService.getCreditMemo).mockResolvedValue(memo());
    renderPage();

    expect(await screen.findAllByText('CRDT-000001')).not.toHaveLength(0);
    expect(screen.queryByText('Source Payment')).not.toBeInTheDocument();
  });

  it('has no Items tab for an amount-only memo', async () => {
    vi.mocked(creditMemoService.getCreditMemo).mockResolvedValue(memo());
    renderPage();

    expect(await screen.findByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Items' })).not.toBeInTheDocument();
  });

  it('keeps the Items tab, read-only, for a memo that already has line items', async () => {
    vi.mocked(creditMemoService.getCreditMemo).mockResolvedValue(memo({ lines: [legacyLine] }));
    renderPage();

    expect(await screen.findByRole('button', { name: 'Items' })).toBeInTheDocument();
  });

  it('shows a discount total only when the memo has one', async () => {
    vi.mocked(creditMemoService.getCreditMemo).mockResolvedValue(memo());
    renderPage();
    await screen.findAllByText('CRDT-000001');
    expect(screen.queryByText('Discount')).not.toBeInTheDocument();
  });
});
