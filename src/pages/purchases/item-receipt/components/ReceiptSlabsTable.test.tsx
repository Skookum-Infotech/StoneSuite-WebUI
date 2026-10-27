import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { ReceiptSlabsTable } from './ReceiptSlabsTable';
import type { ItemReceiptLine } from '@/types/itemReceipt';

function receiptLine(overrides: Partial<ItemReceiptLine> = {}): ItemReceiptLine {
  return {
    id: 'irl-1', lineNumber: 2, purchaseOrderItemId: 'poi-1', sku: 'AB-30', itemName: 'Absolute Black',
    description: '', unitCode: 'SQFT', qtyReceived: 100, qtyRejected: 0, qtyOrdered: 500, qtyReceivedToDate: 100,
    ...overrides,
  };
}

const postedSlab = {
  serial: 'PORD-000012-001', lengthMm: 3048, widthMm: 1524, thicknessMm: 30, area: 50,
  binPath: 'YARD-A/AF-03', lot: 'L1', grade: 'A', unitId: 'unit-uuid-1', unitStatus: 'available',
};

function renderTable(lines: ItemReceiptLine[]) {
  return render(<MemoryRouter><ReceiptSlabsTable lines={lines} /></MemoryRouter>);
}

describe('ReceiptSlabsTable', () => {
  it('renders nothing for a receipt with no slab lines', () => {
    const { container } = renderTable([receiptLine()]);
    expect(container).toBeEmptyDOMElement();
  });

  it('groups slabs under the line they arrived on', () => {
    renderTable([receiptLine({ slabs: [postedSlab, { ...postedSlab, serial: 'PORD-000012-002', unitId: 'unit-uuid-2' }] })]);

    expect(screen.getByText('Slabs received')).toBeInTheDocument();
    expect(screen.getByText(/Line 2 — Absolute Black/)).toBeInTheDocument();
    expect(screen.getByText('2 slabs')).toBeInTheDocument();
  });

  it('shows size, area, bin, details and the live status of a posted slab', () => {
    renderTable([receiptLine({ slabs: [postedSlab] })]);

    expect(screen.getByText('3048 × 1524 × 30')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('YARD-A/AF-03')).toBeInTheDocument();
    expect(screen.getByText('Lot L1 · Grade A')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('links a posted slab\'s serial to its unit', () => {
    renderTable([receiptLine({ slabs: [postedSlab] })]);

    expect(screen.getByRole('link', { name: 'Open slab PORD-000012-001' })).toHaveAttribute('href', '/inventory/unit/unit-uuid-1');
  });

  it('says a pending slab\'s serial is assigned when the receipt posts, and offers no link', () => {
    renderTable([receiptLine({
      slabs: [{ lengthMm: 3048, widthMm: 1524, thicknessMm: 30, area: 50 }],
    })]);

    expect(screen.getByText('Assigned when posted')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it.each([
    ['scrapped', 'Scrapped'],
    ['in_transit', 'In transit'],
    ['reserved', 'Reserved'],
  ])('labels a %s slab', (unitStatus, label) => {
    renderTable([receiptLine({ slabs: [{ ...postedSlab, unitStatus }] })]);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('skips lines that have no slabs when others do', () => {
    renderTable([
      receiptLine({ id: 'plain', lineNumber: 1, itemName: 'Sealer' }),
      receiptLine({ slabs: [postedSlab] }),
    ]);
    expect(screen.queryByText(/Line 1 — Sealer/)).not.toBeInTheDocument();
    expect(screen.getByText(/Line 2 — Absolute Black/)).toBeInTheDocument();
  });
});
