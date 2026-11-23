import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LineReceivingProgress } from './LineReceivingProgress';
import type { PurchaseOrderLine } from '@/types/purchaseOrder';

const LINE: PurchaseOrderLine = {
  id: 'l-1', lineNumber: 2, sku: 'CAL-01', itemName: 'Calacatta Slab', description: '', unitCode: '',
  quantity: 10, qtyReceived: 4, qtyBilled: 2, unitPrice: 5, discountPercent: 0, taxPercent: 0,
  lineSubtotal: 50, lineDiscount: 0, lineTax: 0, lineTotal: 50,
};

const TRIGGER = 'Receiving progress for Calacatta Slab: 40%. Show details';

describe('LineReceivingProgress', () => {
  it('shows the line bar and percent', () => {
    render(<LineReceivingProgress line={LINE} />);
    expect(screen.getByRole('button', { name: TRIGGER })).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('opens a card scoped to that line', async () => {
    const user = userEvent.setup();
    render(<LineReceivingProgress line={LINE} />);

    await user.click(screen.getByRole('button', { name: TRIGGER }));

    expect(await screen.findByText('Line 2 · CAL-01')).toBeInTheDocument();
    expect(screen.getByText('4 of 10 received')).toBeInTheDocument();
    expect(screen.getByText('6 still to come')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Billed for Calacatta Slab' })).toHaveAttribute('aria-valuetext', '2 of 10');
    expect(screen.queryByText('Lines')).not.toBeInTheDocument();
  });

  it('shows slab progress for a slab line', async () => {
    const user = userEvent.setup();
    render(<LineReceivingProgress line={{ ...LINE, expectedSlabs: 12, slabsReceived: 11 }} />);

    await user.click(screen.getByRole('button', { name: TRIGGER }));

    expect(await screen.findByText('11 of about 12 slabs')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<LineReceivingProgress line={LINE} />);

    await user.click(screen.getByRole('button', { name: TRIGGER }));
    expect(await screen.findByText('Line 2 · CAL-01')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.queryByText('Line 2 · CAL-01')).not.toBeInTheDocument();
  });
});
