import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The catalogue picker searches the server; here it is a button per item that
// hands the tab an item exactly as a real pick would.
vi.mock('@/pages/sales/components/InventoryItemPicker', () => ({
  InventoryItemPicker: ({ onPick, value }: { onPick: (item: unknown) => void; value: string }) => (
    <div>
      <span data-testid="picked">{value}</span>
      <button type="button" onClick={() => onPick(SLAB_ITEM)}>pick slab item</button>
      <button type="button" onClick={() => onPick(SINK_ITEM)}>pick sink</button>
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

import { VendorBillItemsTab } from './VendorBillItemsTab';
import type { VendorBillLineItem } from '@/lib/vendorBillForm';

const base = {
  description: '', isActive: true, customFields: {}, materialId: null, colorId: null, finishId: null,
  barcode: '', createdAt: '', updatedAt: '',
};
// A 120 x 60 in, 1.25 in thick slab: 3048 x 1524 x 31.75 mm.
const SLAB_ITEM = {
  ...base, id: 'item-slab', sku: 'AB-30', name: 'Absolute Black', unitId: 6, unitPrice: 20, purchaseUnitPrice: 10,
  tracking: 'serialized', dimensionUnit: 'in', lengthMm: 3048, widthMm: 1524, thicknessMm: 31.75,
};
const SINK_ITEM = {
  ...base, id: 'item-sink', sku: 'SNK-1', name: 'Undermount Sink', unitId: 1, unitPrice: 250, purchaseUnitPrice: 150,
  tracking: 'quantity', dimensionUnit: 'in', lengthMm: 0, widthMm: 0, thicknessMm: 0,
};

function Harness() {
  const [items, setItems] = useState<VendorBillLineItem[]>([]);
  return <VendorBillItemsTab items={items} onUpdate={setItems} headerTaxPercent={0} />;
}

async function addAndPick(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: 'Add Line' }));
  await user.click(screen.getByRole('button', { name }));
}

describe('VendorBillItemsTab — slab size columns', () => {
  it('shows L, W, Thick and Slabs in the Sales order', () => {
    render(<Harness />);
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads.slice(heads.indexOf('L'), heads.indexOf('Slabs') + 1)).toEqual(['L', 'W', 'Thick', 'Slabs']);
  });

  it("fills length, width and thickness from the item's standard slab", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await addAndPick(user, 'pick slab item');

    expect(screen.getByRole('textbox', { name: 'Length (in)' })).toHaveValue('120');
    expect(screen.getByRole('textbox', { name: 'Width (in)' })).toHaveValue('60');
    expect(screen.getByRole('textbox', { name: 'Thickness (in)' })).toHaveValue('1.25');
    // 120 x 60 in is 50 sq ft, so the quantity is worked out from the size.
    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue(50);
  });

  it('folds the size cells away for a per-piece item such as a sink', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await addAndPick(user, 'pick sink');

    expect(screen.queryByRole('textbox', { name: /^Length/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^Width/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^Thickness/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Slabs' })).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).not.toHaveAttribute('readonly');
  });
});
