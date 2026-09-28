import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AmountsStrip, type AmountItem } from './AmountsStrip';

const ITEMS: AmountItem[] = [
  { label: 'Subtotal', value: 1200 },
  { label: 'Discount', value: 0 },
  { label: 'Grand Total', value: 1296, emphasis: 'strong' },
  { label: 'Balance Due', value: 796, emphasis: 'key' },
];

function figure(label: string): HTMLElement {
  const term = screen.getByText(label);
  const tile = term.parentElement;
  if (!tile) throw new Error(`No tile for ${label}`);
  return within(tile).getByText(/\$/);
}

describe('AmountsStrip', () => {
  it('shows every label next to its formatted amount', () => {
    render(<AmountsStrip items={ITEMS} />);

    const group = screen.getByRole('group', { name: 'Amounts' });
    expect(within(group).getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Subtotal', 'Discount', 'Grand Total', 'Balance Due',
    ]);
    expect(figure('Subtotal')).toHaveTextContent('$1,200.00');
    expect(figure('Balance Due')).toHaveTextContent('$796.00');
  });

  it('formats in the currency it is given', () => {
    render(<AmountsStrip items={[{ label: 'Amount', value: 150 }]} currencyCode="CAD" />);
    expect(figure('Amount')).toHaveTextContent('CA$150.00');
  });

  it('lets a zero component recede but never a headline or key figure', () => {
    render(
      <AmountsStrip
        items={[
          { label: 'Discount', value: 0 },
          { label: 'Tax', value: 96 },
          { label: 'Grand Total', value: 0, emphasis: 'strong' },
          { label: 'Balance Due', value: 0, emphasis: 'key' },
        ]}
      />,
    );

    expect(figure('Discount')).toHaveClass('text-stone-400');
    expect(figure('Tax')).not.toHaveClass('text-stone-400');
    expect(figure('Grand Total')).not.toHaveClass('text-stone-400');
    expect(figure('Balance Due')).not.toHaveClass('text-stone-400');
  });

  it('tints only the key figure', () => {
    render(<AmountsStrip items={ITEMS} />);

    expect(screen.getByText('Balance Due').parentElement).toHaveClass('bg-accent');
    expect(screen.getByText('Grand Total').parentElement).not.toHaveClass('bg-accent');
    expect(screen.getByText('Subtotal').parentElement).not.toHaveClass('bg-accent');
  });

  it('sets every figure and every label in one size, whatever its emphasis', () => {
    render(<AmountsStrip items={ITEMS} />);

    for (const { label } of ITEMS) {
      expect(figure(label)).toHaveClass('text-sm');
      expect(screen.getByText(label)).toHaveClass('text-xs');
    }
  });

  it('shows emphasis through weight, not size', () => {
    render(<AmountsStrip items={ITEMS} />);

    expect(figure('Subtotal')).toHaveClass('font-medium');
    expect(figure('Grand Total')).toHaveClass('font-bold');
    expect(figure('Balance Due')).toHaveClass('font-bold');
  });
});
