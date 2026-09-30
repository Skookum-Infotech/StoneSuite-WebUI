import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SlabEstimateRow } from './SlabEstimateRow';

// The row is controlled by the line being edited, so the tests drive it through
// a parent that owns the two fields it writes, the way PurchaseOrderItemsTab does.
function Harness({ quantity = '', units = 'SQFT', expectedSlabs = '', onQuantity }: {
  quantity?: string;
  units?: string;
  expectedSlabs?: string;
  onQuantity?: (q: string) => void;
}) {
  const [q, setQ] = useState(quantity);
  const [slabs, setSlabs] = useState(expectedSlabs);
  return (
    <>
      <SlabEstimateRow
        quantity={q}
        units={units}
        expectedSlabs={slabs}
        onChange={(key, value) => {
          if (key === 'quantity') { setQ(value); onQuantity?.(value); } else setSlabs(value);
        }}
      />
      <output aria-label="quantity">{q}</output>
      <output aria-label="slabs">{slabs}</output>
    </>
  );
}

describe('SlabEstimateRow', () => {
  it('fills in the quantity from the slab count and the average size', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole('spinbutton', { name: 'Expected slabs' }), '12');
    await user.type(screen.getByRole('spinbutton', { name: 'Average sq ft per slab' }), '50');

    expect(screen.getByLabelText('quantity')).toHaveTextContent('600');
    expect(screen.getByLabelText('slabs')).toHaveTextContent('12');
    expect(screen.getByText('= 600 sq ft')).toBeInTheDocument();
  });

  it('recalculates when the count changes afterwards', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole('spinbutton', { name: 'Average sq ft per slab' }), '50');
    const slabs = screen.getByRole('spinbutton', { name: 'Expected slabs' });

    await user.type(slabs, '10');
    expect(screen.getByLabelText('quantity')).toHaveTextContent('500');

    await user.clear(slabs);
    await user.type(slabs, '11');
    expect(screen.getByLabelText('quantity')).toHaveTextContent('550');
  });

  it('leaves the quantity alone until both numbers are given', async () => {
    const user = userEvent.setup();
    const onQuantity = vi.fn();
    render(<Harness quantity="420" onQuantity={onQuantity} />);

    await user.type(screen.getByRole('spinbutton', { name: 'Expected slabs' }), '12');

    expect(onQuantity).not.toHaveBeenCalled();
    expect(screen.getByLabelText('quantity')).toHaveTextContent('420');
    expect(screen.queryByText(/^=/)).not.toBeInTheDocument();
  });

  it('still records the count with no average, since it is only a count to check the delivery against', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole('spinbutton', { name: 'Expected slabs' }), '12');

    expect(screen.getByLabelText('slabs')).toHaveTextContent('12');
  });

  it('starts from what a saved line implies', () => {
    render(<Harness quantity="600" expectedSlabs="12" />);
    expect(screen.getByRole('spinbutton', { name: 'Average sq ft per slab' })).toHaveValue(50);
    expect(screen.getByText('= 600 sq ft')).toBeInTheDocument();
  });

  it('says the average is in square metres for an SQM item', () => {
    render(<Harness units="SQM" />);
    expect(screen.getByRole('spinbutton', { name: 'Average sq m per slab' })).toBeInTheDocument();
  });

  it('falls back to a neutral unit name when the item has none', () => {
    render(<Harness units="" />);
    expect(screen.getByRole('spinbutton', { name: 'Average area unit per slab' })).toBeInTheDocument();
  });

  it('explains that the exact area is measured on arrival', () => {
    render(<Harness />);
    expect(screen.getByText(/exact area is\s+measured when the slabs arrive/)).toBeInTheDocument();
  });
});
