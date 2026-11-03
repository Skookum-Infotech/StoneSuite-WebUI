import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The catalogue picker searches the server; here it is a button per item that
// hands the tab an item exactly as a real pick would.
vi.mock('@/pages/sales/components/InventoryItemPicker', () => ({
  InventoryItemPicker: ({ onPick, value }: { onPick: (item: unknown) => void; value: string }) => (
    <div>
      <span data-testid="picked">{value}</span>
      <button type="button" onClick={() => onPick(SLAB_ITEM)}>pick slab item</button>
      <button type="button" onClick={() => onPick(QUANTITY_ITEM)}>pick each item</button>
    </div>
  ),
}));
vi.mock('@/hooks/useInventoryLookups', () => ({
  useInventoryLookups: () => ({
    lookups: {
      units: [
        { id: 6, name: 'Square Foot', code: 'SQFT', isActive: true, isSystem: true, extra: { category: 'area' } },
        { id: 1, name: 'Each', code: 'EA', isActive: true, isSystem: true, extra: { category: 'count' } },
      ],
    },
    isLoading: false,
    error: null,
  }),
}));

import { PurchaseOrderItemsTab } from './PurchaseOrderItemsTab';
import { EMPTY_LINE_ITEM, type PurchaseOrderLineItem } from '@/lib/purchaseOrderForm';

const base = {
  description: '', unitPrice: 18, isActive: true, customFields: {}, materialId: null, colorId: null, finishId: null,
  thicknessMm: 30, barcode: '', createdAt: '', updatedAt: '',
};
const SLAB_ITEM = { ...base, id: 'item-slab', sku: 'AB-30', name: 'Absolute Black', unitId: 6, tracking: 'serialized' };
const QUANTITY_ITEM = {
  ...base, id: 'item-each', sku: 'SEAL-1', name: 'Sealer', unitId: 1, unitPrice: 12, purchaseUnitPrice: 7.5, tracking: 'quantity',
};

const noop = () => undefined;

function Harness({ initial = [] as PurchaseOrderLineItem[], onChange = noop }: {
  initial?: PurchaseOrderLineItem[];
  onChange?: (items: PurchaseOrderLineItem[]) => void;
}) {
  const [items, setItems] = useState(initial);
  return (
    <PurchaseOrderItemsTab
      items={items}
      onUpdate={(next) => { setItems(next); onChange(next); }}
      headerTaxPercent={0}
    />
  );
}

async function startAdding(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Add Line' }));
}

describe('PurchaseOrderItemsTab — the line price', () => {
  it('defaults a picked item to its purchasing price, not its selling price', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await startAdding(user);

    await user.click(screen.getByRole('button', { name: 'pick each item' }));

    // Sealer sells for 12 and costs 7.5: a purchase line is what we pay.
    expect(screen.getByRole('spinbutton', { name: 'Unit Price' })).toHaveValue(7.5);
  });

  it('uses the selling price for an item the API sent without a purchasing price', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await startAdding(user);

    await user.click(screen.getByRole('button', { name: 'pick slab item' }));

    expect(screen.getByRole('spinbutton', { name: 'Unit Price' })).toHaveValue(18);
  });
});

describe('PurchaseOrderItemsTab — the Units column', () => {
  it('shows the unit as soon as an item is picked, not a dash', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await startAdding(user);

    await user.click(screen.getByRole('button', { name: 'pick slab item' }));

    const row = screen.getByTestId('picked').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Sq ft')).toBeInTheDocument();
  });

  it('shows a count unit as Each', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await startAdding(user);

    await user.click(screen.getByRole('button', { name: 'pick each item' }));

    expect(within(screen.getByTestId('picked').closest('tr') as HTMLElement).getByText('Each')).toBeInTheDocument();
  });

  it('keeps the unit on the saved line', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await startAdding(user);
    await user.click(screen.getByRole('button', { name: 'pick each item' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Quantity' }), '30');

    await user.click(screen.getByRole('button', { name: 'Save Line' }));

    const saved = screen.getByText('Sealer').closest('tr') as HTMLElement;
    expect(within(saved).getByText('Each')).toBeInTheDocument();
    expect(within(saved).getByText('30')).toBeInTheDocument();
  });

  it('accepts a fractional quantity, since a square-foot total is rarely a whole number', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await startAdding(user); // the quantity box only exists while a line is being added

    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toHaveAttribute('step', 'any');
  });
});

describe('PurchaseOrderItemsTab — slab lines', () => {
  it('has no separate slab estimate box; the slab count is the Slabs column', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await startAdding(user);

    await user.click(screen.getByRole('button', { name: 'pick slab item' }));

    expect(screen.queryByText('Slab estimate')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Expected slabs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: /Average .* per slab/ })).not.toBeInTheDocument();
  });

  it('drops the count when the line is switched to a non-slab item', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const saved: PurchaseOrderLineItem = {
      ...EMPTY_LINE_ITEM, id: 'l1', lineNo: 1, itemName: 'Absolute Black', itemSku: 'AB-30', units: 'SQFT',
      quantity: '600', unitPrice: '18', amount: '10800.00', total: '10800.00', inventoryItemUuid: 'item-slab',
      tracking: 'serialized', expectedSlabs: '12',
    };
    render(<Harness initial={[saved]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Edit line Absolute Black' }));

    await user.click(screen.getByRole('button', { name: 'pick each item' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Quantity' }), '3');
    await user.click(screen.getByRole('button', { name: 'Save Line' }));

    const [row] = onChange.mock.calls.at(-1)?.[0] as PurchaseOrderLineItem[];
    expect(row.expectedSlabs).toBe('');
    expect(row.tracking).toBe('quantity');
  });
});

describe('PurchaseOrderItemsTab — saved row actions', () => {
  const saved: PurchaseOrderLineItem = {
    ...EMPTY_LINE_ITEM, id: 'l1', lineNo: 1, itemName: 'Absolute Black', quantity: '2', unitPrice: '18',
  };

  it('offers Edit and Remove for a saved row by label, with no hover needed to see them', () => {
    render(<Harness initial={[saved]} />);

    const edit = screen.getByRole('button', { name: 'Edit line Absolute Black' });
    const remove = screen.getByRole('button', { name: 'Remove line Absolute Black' });
    expect(edit).toBeVisible();
    expect(remove).toBeVisible();
    // Not hover-gated: the hiding classes would make the icons invisible on touch.
    expect(edit.parentElement?.className).not.toMatch(/opacity-0/);
    // Pinned so a wide table's horizontal scroll cannot carry them off screen.
    expect(edit.closest('td')).toHaveClass('sticky', 'right-0', 'bg-white');
  });

  it('opens the row for editing from the Edit button', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[saved]} />);

    await user.click(screen.getByRole('button', { name: 'Edit line Absolute Black' }));

    expect(screen.getByRole('button', { name: 'Save Line' })).toBeInTheDocument();
  });
});

describe('PurchaseOrderItemsTab — the Thickness column', () => {
  it('starts at the picked item\'s own thickness, in the line\'s unit', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await startAdding(user);

    await user.click(screen.getByRole('button', { name: 'pick slab item' }));

    // The item is 30 mm thick; the line is measured in inches.
    expect(screen.getByRole('textbox', { name: 'Thickness (in)' })).toHaveValue('1.18');
  });

  it('can be typed over, and is saved with the line and shown on its row', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await startAdding(user);
    await user.click(screen.getByRole('button', { name: 'pick slab item' }));
    const box = screen.getByRole('textbox', { name: 'Thickness (in)' });

    await user.clear(box);
    await user.type(box, '0.75');
    await user.click(screen.getByRole('button', { name: 'Save Line' }));

    const [saved] = onChange.mock.calls[0][0] as PurchaseOrderLineItem[];
    expect(saved.thickness).toBe('0.75');
    const row = screen.getByText('Absolute Black').closest('tr') as HTMLElement;
    expect(within(row).getByText('0.75 in')).toBeInTheDocument();
  });

  it('ignores letters and stops at the server\'s cap', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await startAdding(user);
    await user.click(screen.getByRole('button', { name: 'pick slab item' }));
    const box = screen.getByRole('textbox', { name: 'Thickness (in)' });

    await user.clear(box);
    await user.type(box, 'ab5');
    expect(box).toHaveValue('5');

    await user.clear(box);
    await user.type(box, '99');
    expect(box).toHaveValue('39.37'); // 1 m
  });

  it('is disabled on a line that is not measured by area', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await startAdding(user);

    await user.click(screen.getByRole('button', { name: 'pick each item' }));

    expect(screen.getByRole('textbox', { name: 'Thickness (in)' })).toBeDisabled();
  });
});
