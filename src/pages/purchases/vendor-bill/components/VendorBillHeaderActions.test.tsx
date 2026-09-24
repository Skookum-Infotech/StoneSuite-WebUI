import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VendorBillHeaderActions } from './VendorBillHeaderActions';

type Order = Parameters<typeof VendorBillHeaderActions>[0]['order'];

const approved: Order = { statusCode: 'APPV', approvalStatus: 'approved' };
const partial: Order = { statusCode: 'PART', approvalStatus: 'approved' };
const overdue: Order = { statusCode: 'ODUE', approvalStatus: 'approved' };
const draft: Order = { statusCode: 'DRFT', approvalStatus: 'none' };
const pending: Order = { statusCode: 'PAPV', approvalStatus: 'pending', gated: true };
const paid: Order = { statusCode: 'PAID', approvalStatus: 'approved' };
const voided: Order = { statusCode: 'VOID', approvalStatus: 'approved' };

const OVERDUE = 'Mark Overdue';
const PARTIAL = 'Mark Partially Paid';
const PAID = 'Mark Paid';

function renderActions(order: Order, props: Partial<Parameters<typeof VendorBillHeaderActions>[0]> = {}) {
  const onTransition = vi.fn();
  render(<VendorBillHeaderActions order={order} canTransition onTransition={onTransition} {...props} />);
  return { onTransition };
}

const names = () => screen.queryAllByRole('button').map((b) => b.getAttribute('aria-label'));

describe('VendorBillHeaderActions', () => {
  it('offers all three settlement moves from Approved, Paid last so it sits in the corner', () => {
    renderActions(approved);

    expect(names()).toEqual([OVERDUE, PARTIAL, PAID]);
  });

  it('offers only the moves still legal from Partially Paid', () => {
    renderActions(partial);

    expect(names()).toEqual([OVERDUE, PAID]);
  });

  it('offers only the moves still legal from Overdue', () => {
    renderActions(overdue);

    expect(names()).toEqual([PARTIAL, PAID]);
  });

  it.each([
    ['a draft', draft],
    ['awaiting approval', pending],
    ['paid', paid],
    ['void', voided],
  ])('offers no settlement button on a bill that is %s', (_label, order) => {
    renderActions(order);

    expect(names()).toEqual([]);
  });

  it('shows no buttons without vendor_bill:transition', () => {
    renderActions(approved, { canTransition: false });

    expect(names()).toEqual([]);
  });

  it.each([
    [OVERDUE, 'ODUE'],
    [PARTIAL, 'PART'],
    [PAID, 'PAID'],
  ])('%s asks the page for the %s move — the page decides whether to confirm it', async (name, code) => {
    const { onTransition } = renderActions(approved);

    await userEvent.setup().click(screen.getByRole('button', { name }));

    expect(onTransition).toHaveBeenCalledOnce();
    expect(onTransition).toHaveBeenCalledWith(code);
  });

  it('uses the backend next-moves when loaded, hiding a move it has ruled out', () => {
    renderActions({ ...approved, nextStatusCodes: ['PAID', 'VOID'] });

    expect(names()).toEqual([PAID]);
  });

  it('disables the buttons, with the reason, while the approval gate blocks the move', () => {
    renderActions({ ...approved, approvalStatus: 'pending', gated: true });

    for (const name of [OVERDUE, PARTIAL, PAID]) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Awaiting approval sign-off');
    }
  });

  it('disables every button while a move is in flight, spinning only the one requested', () => {
    renderActions(approved, { pendingCode: 'PAID' });

    for (const name of [OVERDUE, PARTIAL, PAID]) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: PAID }).querySelector('.animate-spin')).not.toBeNull();
    expect(screen.getByRole('button', { name: OVERDUE }).querySelector('.animate-spin')).toBeNull();
  });

  it('keeps the "Mark " prefix out of view on phones only, so three buttons still fit', () => {
    renderActions(approved);

    const prefix = screen.getByRole('button', { name: PAID }).querySelector('span span');
    expect(prefix).toHaveTextContent('Mark');
    expect(prefix).toHaveClass('hidden', 'sm:inline');
  });

  it('gives Paid the solid emphasis and the other two an outline', () => {
    renderActions(approved);

    expect(screen.getByRole('button', { name: PAID })).toHaveClass('bg-emerald-600', 'text-white');
    expect(screen.getByRole('button', { name: PARTIAL })).toHaveClass('bg-white', 'text-amber-700');
    expect(screen.getByRole('button', { name: OVERDUE })).toHaveClass('bg-white', 'text-red-700');
  });
});
