import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmVendorBillStatusDialog } from './ConfirmVendorBillStatusDialog';

function renderDialog(props: Partial<Parameters<typeof ConfirmVendorBillStatusDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmVendorBillStatusDialog
      target="PAID"
      billNumber="VB-1001"
      pending={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
}

describe('ConfirmVendorBillStatusDialog', () => {
  it('asks to mark the bill Paid, naming it and saying it is final', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Mark VB-1001 as Paid?' })).toBeInTheDocument();
    expect(screen.getByText(/cannot be moved to another status/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark Paid' })).toBeInTheDocument();
  });

  it('asks to void the bill, naming it and saying it can no longer be paid or edited', () => {
    renderDialog({ target: 'VOID' });

    expect(screen.getByRole('dialog', { name: 'Void VB-1001?' })).toBeInTheDocument();
    expect(screen.getByText(/can no longer be paid or edited/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Void vendor bill' })).toBeInTheDocument();
  });

  it('confirms only on the confirm button', async () => {
    const { onConfirm, onCancel } = renderDialog({ target: 'VOID' });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Void vendor bill' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels from the Cancel button, Escape, and a click on the backdrop', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('dialog'));

    expect(onCancel).toHaveBeenCalledTimes(3);
  });

  it('ignores backdrop clicks and disables both buttons while the move is in flight', async () => {
    const { onCancel } = renderDialog({ pending: true });

    expect(screen.getByRole('button', { name: 'Marking paid…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('dialog'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('moves focus into the dialog on open', () => {
    renderDialog();

    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });
});
