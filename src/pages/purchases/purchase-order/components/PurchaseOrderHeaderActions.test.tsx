import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PurchaseOrderHeaderActions } from './PurchaseOrderHeaderActions';

type Order = Parameters<typeof PurchaseOrderHeaderActions>[0]['order'];

const draftNoApprovers: Order = { statusCode: 'DRFT', approvalStatus: 'none', nextStatusCodes: ['CANC', 'SENT'] };
const draftWithApprovers: Order = { statusCode: 'DRFT', approvalStatus: 'none', nextStatusCodes: ['PAPV', 'CANC'] };
const approved: Order = { statusCode: 'APPV', approvalStatus: 'approved', nextStatusCodes: ['SENT', 'DRFT', 'CANC'] };
const pending: Order = { statusCode: 'PAPV', approvalStatus: 'pending', gated: true, nextStatusCodes: ['APPV', 'DRFT', 'CANC'] };
const sent: Order = { statusCode: 'SENT', approvalStatus: 'approved', nextStatusCodes: ['PART', 'RCVD', 'CLSD', 'CANC'] };

function renderActions(order: Order, props: Partial<Parameters<typeof PurchaseOrderHeaderActions>[0]> = {}) {
  const onTransition = vi.fn();
  render(
    <PurchaseOrderHeaderActions
      order={order}
      canTransition
      onTransition={onTransition}
      transitioning={false}
      {...props}
    />,
  );
  return { onTransition };
}

describe('PurchaseOrderHeaderActions', () => {
  it('offers Send to Vendor straight from Draft when nobody is configured to approve', async () => {
    const { onTransition } = renderActions(draftNoApprovers);

    expect(screen.queryByRole('button', { name: 'Submit for Approval' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Send to Vendor' }));

    expect(onTransition).toHaveBeenCalledOnce();
    expect(onTransition).toHaveBeenCalledWith('SENT');
  });

  it('offers Submit for Approval from Draft when an approver is configured', async () => {
    const { onTransition } = renderActions(draftWithApprovers);

    expect(screen.queryByRole('button', { name: 'Send to Vendor' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Submit for Approval' }));

    expect(onTransition).toHaveBeenCalledWith('PAPV');
  });

  it('offers Send to Vendor once approved', async () => {
    const { onTransition } = renderActions(approved);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Send to Vendor' }));

    expect(onTransition).toHaveBeenCalledWith('SENT');
  });

  it.each([
    ['awaiting approval', pending],
    ['already sent', sent],
  ])('offers no status button while %s', (_label, order) => {
    renderActions(order);

    expect(screen.queryByRole('button', { name: 'Send to Vendor' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit for Approval' })).not.toBeInTheDocument();
  });

  it('shows no status button without purchase_order:transition', () => {
    renderActions(approved, { canTransition: false });

    expect(screen.queryByRole('button', { name: 'Send to Vendor' })).not.toBeInTheDocument();
  });

  it('disables the button, with the reason, while the approval gate blocks the move', () => {
    renderActions({ ...approved, approvalStatus: 'pending', gated: true });

    const button = screen.getByRole('button', { name: 'Send to Vendor' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Awaiting approval sign-off');
  });

  it('disables the button while a transition is in flight', () => {
    renderActions(approved, { transitioning: true });

    expect(screen.getByRole('button', { name: 'Send to Vendor' })).toBeDisabled();
  });

  it('shows Receive items only when a receive handler is passed, and fires it', async () => {
    const onReceive = vi.fn();
    const { onTransition } = renderActions(sent, { onReceive });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Receive items' }));

    expect(onReceive).toHaveBeenCalledOnce();
    expect(onTransition).not.toHaveBeenCalled();
  });

  it('omits Receive items when there is no receive handler', () => {
    renderActions(sent);

    expect(screen.queryByRole('button', { name: 'Receive items' })).not.toBeInTheDocument();
  });
});
