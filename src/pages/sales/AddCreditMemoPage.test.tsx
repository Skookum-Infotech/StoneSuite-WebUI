import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { CrmLookups } from '@/services/lookupService';
import type { CreditMemo } from '@/types/creditMemo';

vi.mock('@/services/creditMemoService', () => ({
  creditMemoService: { createCreditMemo: vi.fn() },
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
    provide: () => ({ startCreate: vi.fn() }),
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
vi.mock('@/hooks/useScrollToError', () => ({ useScrollToError: () => null }));

import AddCreditMemoPage from './AddCreditMemoPage';
import { CREDIT_MEMO_FROM_PAYMENT_STATE } from '@/lib/creditMemoHandoff';
import { creditMemoService } from '@/services/creditMemoService';
import { lookupService } from '@/services/lookupService';
import { workflowService } from '@/services/tenantServices';

function Providers() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{
        pathname: '/sales/credit_memo/new',
        state: {
          [CREDIT_MEMO_FROM_PAYMENT_STATE]: {
            customer: { id: 'cust-1', name: 'Acme Stoneworks' },
            invoices: [{ id: 'inv-1', number: 'INV-000001' }],
            payment: { id: 'pay-1', number: 'PAY-000001' },
            currencyId: 2,
            currencyCode: 'CAD',
            unappliedAmount: 24.5,
          },
        },
      }]}>
        <Routes>
          <Route path="/sales/credit_memo/new" element={<AddCreditMemoPage />} />
          <Route path="/sales/credit_memo/:id" element={<div>credit memo saved</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function submitForm() {
  // Billing fields are required natively and the handoff carries no address,
  // so submit the form directly instead of through the (blocked) button.
  const form = document.querySelector('form');
  if (!form) throw new Error('form not found');
  fireEvent.submit(form);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(lookupService.getCrmLookups).mockResolvedValue({
    customerTypes: [],
    crmStatuses: [{ id: 1, code: 'ACTV', name: 'Active' }],
    arStatuses: [],
    paymentTerms: [],
    priceLevels: [],
    currencies: [{ id: 2, code: 'CAD', name: 'Canadian Dollar' }],
    countries: [{ id: 1, code: 'US', name: 'United States' }],
    states: [],
    leadSources: [],
    contactMethods: [],
    employees: [],
    parentCustomers: [],
  } satisfies CrmLookups);
  vi.mocked(workflowService.list).mockResolvedValue([]);
  vi.mocked(creditMemoService.createCreditMemo).mockResolvedValue({ id: 'cm-1' } as CreditMemo);
});

describe('AddCreditMemoPage payment handoff', () => {
  it('prefills the customer, invoice, currency, reference, source payment and excess amount', async () => {
    render(<Providers />);

    expect(await screen.findByText('Acme Stoneworks')).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Canadian Dollar' })).toBeInTheDocument();
    expect(screen.getByText('INV-000001')).toBeInTheDocument();
    expect(screen.getByText('PAY-000001')).toBeInTheDocument();
    expect(screen.getAllByText('Prefilled from PAY-000001. Review before saving.')).toHaveLength(2);
    expect(screen.getByLabelText('Currency')).toHaveValue('2');
    expect(screen.getByLabelText('Reference #')).toHaveValue('PAY-000001');
    expect(screen.getByLabelText('Reason')).toHaveValue('Excess payment');
    expect(screen.getByLabelText('Memo')).toHaveValue('Created from payment PAY-000001 for invoice INV-000001.');
    expect(screen.getByLabelText('Amount')).toHaveValue(24.5);
    expect(screen.getAllByText('CA$24.50').length).toBeGreaterThanOrEqual(2);
  });

  it('has no line items section', async () => {
    render(<Providers />);

    expect(await screen.findByText('Acme Stoneworks')).toBeInTheDocument();
    expect(screen.queryByText('Items')).not.toBeInTheDocument();
    expect(screen.queryByText('Excess from payment PAY-000001')).not.toBeInTheDocument();
  });

  it('clears payment and invoice lineage when the customer changes', async () => {
    render(<Providers />);

    expect(await screen.findByText('Acme Stoneworks')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Change billing customer' }));

    expect(screen.queryByText('INV-000001')).not.toBeInTheDocument();
    expect(screen.queryByText('PAY-000001')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Currency')).toHaveValue('');
  });

  it('saves the amount and the payment it is issued from, with no line items', async () => {
    render(<Providers />);
    expect(await screen.findByText('Acme Stoneworks')).toBeInTheDocument();

    submitForm();

    await waitFor(() => expect(creditMemoService.createCreditMemo).toHaveBeenCalledWith(expect.objectContaining({
      customerUuid: 'cust-1',
      invoiceUuid: 'inv-1',
      sourcePaymentUuid: 'pay-1',
      amount: 24.5,
      currencyId: 2,
    })));
    expect(vi.mocked(creditMemoService.createCreditMemo).mock.calls[0][0]).not.toHaveProperty('lines');
    expect(await screen.findByText('credit memo saved')).toBeInTheDocument();
  });

  // Regression: a number input with no step only accepts whole numbers counted
  // from min, so typing 100 was refused with 'nearest valid values 99.01 and 100.01'.
  it.each(['100', '100.5', '0.01', '2500.75'])('lets the user type an amount of %s', async (typed) => {
    render(<Providers />);
    expect(await screen.findByText('Acme Stoneworks')).toBeInTheDocument();

    const amount = screen.getByLabelText('Amount') as HTMLInputElement;
    await userEvent.clear(amount);
    await userEvent.type(amount, typed);

    expect(amount.value).toBe(typed);
    expect(amount.validity.valid).toBe(true);
  });

  it('does not save without an amount', async () => {
    render(<Providers />);
    expect(await screen.findByText('Acme Stoneworks')).toBeInTheDocument();

    const amount = screen.getByLabelText('Amount');
    await userEvent.clear(amount);
    submitForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter an amount greater than zero.');
    expect(creditMemoService.createCreditMemo).not.toHaveBeenCalled();
  });
});
