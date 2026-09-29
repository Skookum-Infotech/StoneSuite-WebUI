import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VendorPaymentHeaderActions } from './VendorPaymentHeaderActions';

type Order = Parameters<typeof VendorPaymentHeaderActions>[0]['order'];

function setup(order: Order, canTransition = true) {
  const onTransition = vi.fn();
  render(<VendorPaymentHeaderActions order={order} canTransition={canTransition} onTransition={onTransition} />);
  return onTransition;
}

describe('VendorPaymentHeaderActions', () => {
  it('shows action-verb buttons for a draft, never Void', async () => {
    const user = userEvent.setup();
    const onTransition = setup({ statusCode: 'DRFT', approvalStatus: 'none' });
    expect(screen.getByRole('button', { name: 'Submit for Approval' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Void' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit for Approval' }));
    expect(onTransition).toHaveBeenCalledWith('PAPV');
  });

  it('never offers the approval-only PAPV -> APPV move', () => {
    setup({ statusCode: 'PAPV', approvalStatus: 'pending' });
    expect(screen.getByRole('button', { name: 'Recall to Draft' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument();
  });

  it('disables Schedule Payment until a scheduled date is set', () => {
    setup({ statusCode: 'APPV', approvalStatus: 'approved', scheduledDate: null });
    expect(screen.getByRole('button', { name: 'Schedule Payment' })).toBeDisabled();
  });

  it('renders nothing without transition permission', () => {
    setup({ statusCode: 'DRFT', approvalStatus: 'none' }, false);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
