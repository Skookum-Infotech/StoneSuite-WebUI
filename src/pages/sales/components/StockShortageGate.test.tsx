import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/lib/requisitionPrefill', () => ({ openRequisitionForShortages: vi.fn() }));

import { StockShortageGate } from './StockShortageGate';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { openRequisitionForShortages } from '@/lib/requisitionPrefill';
import type { StockShortage } from '@/types/salesOrder';

const SHORT: StockShortage = {
  itemId: 'item-1', sku: 'GRAN-001', name: 'Absolute Black', unitCode: 'SQFT', requested: 60, available: 40, short: 20,
};

function shortageError(): AxiosError {
  const response = {
    status: 409, statusText: '', headers: {}, config: {},
    data: { success: false, code: 'insufficient_stock', message: 'Not enough stock', shortages: [SHORT] },
  } as AxiosResponse;
  return new AxiosError('failed', '409', undefined, undefined, response);
}

function can(...granted: string[]) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => granted.includes(`${resource}:${action}`),
  } as ReturnType<typeof useUserPermissions>);
}

beforeEach(() => {
  vi.clearAllMocks();
  can('requisition:create');
});

describe('StockShortageGate', () => {
  it('shows the dialog when the save was refused for lack of stock', () => {
    render(<StockShortageGate error={shortageError()} />);

    expect(screen.getByRole('alertdialog', { name: 'Not enough stock' })).toBeInTheDocument();
    expect(screen.getByText('Absolute Black')).toBeInTheDocument();
  });

  it.each([
    ['no error', null],
    ['a different failure', new Error('Failed to save sales order.')],
  ])('shows nothing for %s', (_name, error) => {
    render(<StockShortageGate error={error} />);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('stays closed once dismissed, until the next refused save', async () => {
    const first = shortageError();
    const { rerender } = render(<StockShortageGate error={first} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    rerender(<StockShortageGate error={first} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    rerender(<StockShortageGate error={shortageError()} />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('hands the shortfall to a new requisition', async () => {
    render(<StockShortageGate error={shortageError()} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Create requisition for the shortfall' }));

    expect(openRequisitionForShortages).toHaveBeenCalledWith([SHORT]);
  });

  it('offers no requisition to a user who may not create one', () => {
    can();
    render(<StockShortageGate error={shortageError()} />);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create requisition/i })).not.toBeInTheDocument();
  });
});
