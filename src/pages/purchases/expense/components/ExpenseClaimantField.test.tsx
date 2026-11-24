import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/expenseService', () => ({
  expenseService: { getClaimants: vi.fn() },
}));

import { ExpenseClaimantField } from './ExpenseClaimantField';
import { expenseService } from '@/services/expenseService';
import { chooseOpenOption } from '@/test/selectHelpers';

const CLAIMANTS = [
  { id: 7, code: 'ana@example.com', name: 'Ana Diaz' },
  { id: 9, code: 'bo@example.com', name: 'Bo Lin' },
];

function renderField(props: Partial<React.ComponentProps<typeof ExpenseClaimantField>> = {}) {
  const onChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ExpenseClaimantField value="" onChange={onChange} allowSelf {...props} />
    </QueryClientProvider>,
  );
  return onChange;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(expenseService.getClaimants).mockResolvedValue(CLAIMANTS);
});

describe('ExpenseClaimantField', () => {
  it('starts on "Myself" for a new claim and lets another employee be picked', async () => {
    const onChange = renderField();

    const trigger = await screen.findByRole('combobox', { name: 'Employee' });
    expect(trigger).toHaveTextContent('Myself');
    await userEvent.setup().click(trigger);
    await chooseOpenOption('Bo Lin');

    expect(onChange).toHaveBeenCalledWith('9');
  });

  it('does not offer "Myself" once the claim exists', async () => {
    renderField({ value: '7', allowSelf: false });

    const trigger = await screen.findByRole('combobox', { name: 'Employee' });
    await userEvent.setup().click(trigger);

    const listbox = await screen.findByRole('listbox');
    expect(listbox).not.toHaveTextContent('Myself');
    expect(listbox).toHaveTextContent('Ana Diaz');
  });

  it('keeps a claimant who is no longer Active visible', async () => {
    renderField({ value: '99', allowSelf: false, currentName: 'Old Hand' });

    expect(await screen.findByRole('combobox', { name: 'Employee' })).toHaveTextContent('Old Hand');
  });
});
