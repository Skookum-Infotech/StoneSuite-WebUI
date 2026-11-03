import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/inventoryUnitService', () => ({ inventoryUnitService: { reserve: vi.fn() } }));
// The real picker searches the CRM; here it is just a button that picks one customer.
vi.mock('@/pages/sales/components/CustomerPicker', () => ({
  CustomerPicker: ({ value, onChange }: { value: { name: string } | null; onChange: (c: { id: string; name: string } | null) => void }) => (
    value
      ? <span>{value.name}</span>
      : <button type="button" onClick={() => onChange({ id: 'cust-1', name: 'Acme Kitchens' })}>Pick Acme</button>
  ),
}));

import { ReserveUnitDialog } from './ReserveUnitDialog';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { makeUnit } from './unitFixtures';

function renderDialog(overrides: { onClose?: () => void; onReserved?: (name: string) => void } = {}) {
  const props = { onClose: vi.fn(), onReserved: vi.fn(), ...overrides };
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <ReserveUnitDialog unit={makeUnit({ id: 'u1', serial: 'PO-00012-001' })} {...props} />
    </QueryClientProvider>,
  );
  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ReserveUnitDialog', () => {
  it('names the slab and cannot reserve until a customer is chosen', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Reserve for customer' })).toBeInTheDocument();
    expect(screen.getByText(/PO-00012-001/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reserve' })).toBeDisabled();
  });

  it('reserves the slab for the chosen customer, with the note, and reports who', async () => {
    vi.mocked(inventoryUnitService.reserve).mockResolvedValue({ success: true });
    const user = userEvent.setup();
    const { onClose, onReserved } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Pick Acme' }));
    await user.type(screen.getByLabelText('Note'), '  for the Smith kitchen ');
    await user.click(screen.getByRole('button', { name: 'Reserve' }));

    await vi.waitFor(() => expect(inventoryUnitService.reserve).toHaveBeenCalledWith('u1', {
      customerId: 'cust-1', note: 'for the Smith kitchen',
    }));
    await vi.waitFor(() => expect(onReserved).toHaveBeenCalledWith('Acme Kitchens'));
    expect(onClose).toHaveBeenCalled();
  });

  it('sends no note when none was typed', async () => {
    vi.mocked(inventoryUnitService.reserve).mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Pick Acme' }));
    await user.click(screen.getByRole('button', { name: 'Reserve' }));

    await vi.waitFor(() => expect(inventoryUnitService.reserve).toHaveBeenCalledWith('u1', { customerId: 'cust-1', note: undefined }));
  });

  it('shows why the server refused and stays open', async () => {
    vi.mocked(inventoryUnitService.reserve).mockRejectedValue(new Error('This unit is already reserved.'));
    const user = userEvent.setup();
    const { onClose, onReserved } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Pick Acme' }));
    await user.click(screen.getByRole('button', { name: 'Reserve' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onReserved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
