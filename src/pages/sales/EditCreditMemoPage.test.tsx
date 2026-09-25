import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { CrmLookups } from '@/services/lookupService';
import type { CreditMemo } from '@/types/creditMemo';

vi.mock('@/services/creditMemoService', () => ({
  creditMemoService: { getCreditMemo: vi.fn(), updateCreditMemo: vi.fn() },
}));
vi.mock('@/services/lookupService', () => ({
  lookupService: { getCrmLookups: vi.fn() },
}));
vi.mock('@/services/tenantServices', () => ({
  workflowService: { list: vi.fn(), get: vi.fn() },
}));
vi.mock('@/hooks/useScrollToError', () => ({ useScrollToError: () => null }));
vi.mock('@/components/crm/CrmSubTabsPanel', async () => {
  const React = await import('react');
  return {
    EditableFilesPanel: React.forwardRef(function EditableFilesPanel() {
      return null;
    }),
  };
});

import EditCreditMemoPage from './EditCreditMemoPage';
import { creditMemoService } from '@/services/creditMemoService';
import { lookupService } from '@/services/lookupService';
import { workflowService } from '@/services/tenantServices';

function memo(overrides: Partial<CreditMemo> = {}): CreditMemo {
  return {
    id: 'cm-1', creditMemoNumber: 'CRDT-000001', status: 'Draft', statusCode: 'DRFT',
    approvalStatus: 'none', gated: false, approvers: [], requiredApprovals: 0, approvedCount: 0,
    canApprove: false, isOverride: false, callerAlreadyApproved: false,
    customer: { id: 'cust-1', name: 'Acme Stoneworks' }, creditMemoDate: '2026-09-01',
    currencyId: 2, salesTaxPercent: 0, subtotal: 24.5, discountTotal: 0, taxTotal: 0, adjustment: 0,
    grandTotal: 24.5, appliedTotal: 0, unappliedAmount: 24.5, billing: {}, lines: [], applications: [],
    sourcePayment: { id: 'pay-1', number: 'PAY-000001' }, recordVersion: 3,
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/sales/credit_memo/cm-1/edit']}>
        <Routes>
          <Route path="/sales/credit_memo/:id/edit" element={<EditCreditMemoPage />} />
          <Route path="/sales/credit_memo/:id" element={<div>credit memo detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function submitForm() {
  const form = document.querySelector('form');
  if (!form) throw new Error('form not found');
  fireEvent.submit(form);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(creditMemoService.getCreditMemo).mockResolvedValue(memo());
  vi.mocked(creditMemoService.updateCreditMemo).mockResolvedValue(memo());
  vi.mocked(lookupService.getCrmLookups).mockResolvedValue({
    currencies: [{ id: 2, code: 'CAD', name: 'Canadian Dollar' }],
    countries: [], states: [],
  } as unknown as CrmLookups);
  vi.mocked(workflowService.list).mockResolvedValue([]);
});

describe('EditCreditMemoPage', () => {
  it('shows the amount and the source payment, with no line items section', async () => {
    renderPage();

    expect(await screen.findByLabelText('Amount')).toHaveValue(24.5);
    expect(screen.getByText('PAY-000001')).toBeInTheDocument();
    expect(screen.queryByText('Items')).not.toBeInTheDocument();
  });

  it('does not resend the amount when only other fields change', async () => {
    renderPage();
    await userEvent.type(await screen.findByLabelText('Reason'), 'Damaged in transit');

    submitForm();

    await waitFor(() => expect(creditMemoService.updateCreditMemo).toHaveBeenCalled());
    const [id, payload] = vi.mocked(creditMemoService.updateCreditMemo).mock.calls[0];
    expect(id).toBe('cm-1');
    expect(payload).toMatchObject({ reason: 'Damaged in transit', recordVersion: 3 });
    expect(payload).not.toHaveProperty('amount');
    expect(payload).not.toHaveProperty('lines');
  });

  it('sends the amount once it is edited', async () => {
    renderPage();
    const amount = await screen.findByLabelText('Amount');
    await userEvent.clear(amount);
    await userEvent.type(amount, '20');

    submitForm();

    await waitFor(() => expect(creditMemoService.updateCreditMemo).toHaveBeenCalledWith(
      'cm-1',
      expect.objectContaining({ amount: 20, recordVersion: 3 }),
    ));
  });

  // Money fields render read-only (not as an input) once the memo leaves Draft.
  it('shows the amount read-only once the memo has left Draft', async () => {
    vi.mocked(creditMemoService.getCreditMemo).mockResolvedValue(memo({ status: 'Approved', statusCode: 'APPV' }));
    renderPage();

    expect(await screen.findByText('24.50')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Amount' })).not.toBeInTheDocument();
  });
});
