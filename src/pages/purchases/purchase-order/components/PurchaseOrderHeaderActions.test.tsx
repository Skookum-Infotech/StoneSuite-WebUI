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
      actions={{}}
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
    const { onTransition } = renderActions(sent, { actions: { onReceive } });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Receive items' }));

    expect(onReceive).toHaveBeenCalledOnce();
    expect(onTransition).not.toHaveBeenCalled();
  });

  it('omits Receive items when there is no receive handler', () => {
    renderActions(sent);

    expect(screen.queryByRole('button', { name: 'Receive items' })).not.toBeInTheDocument();
  });

  it('shows Create Bill only when a create-bill handler is passed, and fires it', async () => {
    const onCreateBill = vi.fn();
    const { onTransition } = renderActions(sent, { actions: { onCreateBill } });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Create Bill' }));

    expect(onCreateBill).toHaveBeenCalledOnce();
    expect(onTransition).not.toHaveBeenCalled();
  });

  it('omits Create Bill when there is no create-bill handler', () => {
    renderActions(sent);

    expect(screen.queryByRole('button', { name: 'Create Bill' })).not.toBeInTheDocument();
  });

  describe('emphasis — the next step is the one that stands out', () => {
    const partReceived: Order = { statusCode: 'PART', approvalStatus: 'approved', nextStatusCodes: ['RCVD', 'CLSD', 'CANC'] };

    it('fills Receive items when it is the only action, like Send to Vendor', () => {
      renderActions(sent, { actions: { onReceive: vi.fn() } });

      expect(screen.getByRole('button', { name: 'Receive items' })).toHaveClass('bg-brand');
    });

    it('fills Create Bill when it is the only action (a fully received order)', () => {
      renderActions(
        { statusCode: 'RCVD', approvalStatus: 'approved', nextStatusCodes: ['CLSD'] },
        { actions: { onCreateBill: vi.fn() } },
      );

      expect(screen.getByRole('button', { name: 'Create Bill' })).toHaveClass('bg-brand');
    });

    it('fills Receive items and tints Create Bill when a part-received order offers both', () => {
      renderActions(partReceived, { actions: { onReceive: vi.fn(), onCreateBill: vi.fn() } });

      const receive = screen.getByRole('button', { name: 'Receive items' });
      const bill = screen.getByRole('button', { name: 'Create Bill' });
      expect(receive).toHaveClass('bg-brand');
      expect(bill).toHaveClass('bg-brand/10', 'border-brand/50');
      expect(bill).not.toHaveClass('bg-brand');
    });

    it('no longer renders either as a plain white button that reads like Back', () => {
      renderActions(partReceived, { actions: { onReceive: vi.fn(), onCreateBill: vi.fn() } });

      expect(screen.getByRole('button', { name: 'Receive items' })).not.toHaveClass('bg-white');
      expect(screen.getByRole('button', { name: 'Create Bill' })).not.toHaveClass('bg-white');
    });

    it('says what each one will do on hover', () => {
      renderActions(partReceived, { actions: { onReceive: vi.fn(), onCreateBill: vi.fn() } });

      expect(screen.getByRole('button', { name: 'Receive items' })).toHaveAttribute('title', 'Receive goods against this order');
      expect(screen.getByRole('button', { name: 'Create Bill' })).toHaveAttribute('title', 'Bill what has been received and not yet billed');
    });
  });

  it('shows Create Bill on an order with no status moves left (a fully received order can still be billed)', () => {
    renderActions(
      { statusCode: 'RCVD', approvalStatus: 'approved', nextStatusCodes: ['CLSD'] },
      { actions: { onCreateBill: vi.fn() } },
    );

    expect(screen.getByRole('button', { name: 'Create Bill' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send to Vendor' })).not.toBeInTheDocument();
  });
});
