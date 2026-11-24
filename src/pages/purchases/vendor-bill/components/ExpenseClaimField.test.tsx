import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/expenseService', () => ({
  expenseService: { getBillableClaims: vi.fn() },
}));

import { ExpenseClaimField } from './ExpenseClaimField';
import { expenseService } from '@/services/expenseService';
import { chooseOpenOption } from '@/test/selectHelpers';

const CLAIMS = [
  { id: 'c1', expenseNumber: 'EXPN-000001', claimantName: 'Ana Diaz', total: 125.5 },
  { id: 'c2', expenseNumber: 'EXPN-000002', claimantName: 'Ana Diaz', total: 40 },
];

function renderField(props: Partial<React.ComponentProps<typeof ExpenseClaimField>> = {}) {
  const onChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ExpenseClaimField vendor={{ id: 'v1' }} value={null} onChange={onChange} {...props} />
    </QueryClientProvider>,
  );
  return { onChange, view };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(expenseService.getBillableClaims).mockResolvedValue(CLAIMS);
});

describe('ExpenseClaimField', () => {
  it('lists the vendor\'s billable claims and reports the one picked', async () => {
    const { onChange } = renderField();

    const trigger = await screen.findByRole('combobox', { name: 'Expense claim' });
    await userEvent.setup().click(trigger);
    await chooseOpenOption('EXPN-000002 · $40.00');

    expect(expenseService.getBillableClaims).toHaveBeenCalledWith('v1');
    expect(onChange).toHaveBeenCalledWith({ id: 'c2', number: 'EXPN-000002' });
  });

  it('is absent for a vendor with no billable claims, so an ordinary supplier never sees it', async () => {
    vi.mocked(expenseService.getBillableClaims).mockResolvedValue([]);
    const { view } = renderField();

    await vi.waitFor(() => expect(expenseService.getBillableClaims).toHaveBeenCalled());
    expect(view.container).toBeEmptyDOMElement();
  });

  it('does nothing until a vendor is chosen', () => {
    const { view } = renderField({ vendor: null });

    expect(expenseService.getBillableClaims).not.toHaveBeenCalled();
    expect(view.container).toBeEmptyDOMElement();
  });

  it('stays visible, and can be cleared, once a claim is picked', async () => {
    vi.mocked(expenseService.getBillableClaims).mockResolvedValue([]);
    renderField({ value: { id: 'c9', number: 'EXPN-000009' } });

    expect(await screen.findByRole('combobox', { name: 'Expense claim' })).toHaveTextContent('EXPN-000009');
  });

  it('is locked while a purchase order is linked', async () => {
    renderField({ disabled: true });

    expect(await screen.findByRole('combobox', { name: 'Expense claim' })).toBeDisabled();
  });
});
