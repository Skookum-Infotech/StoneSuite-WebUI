import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/inventoryBinService', () => ({ inventoryBinService: { getTree: vi.fn().mockResolvedValue([]) } }));

import { ReceiptLinesTable } from './ReceiptLinesTable';
import { newDraftSlab } from '@/lib/itemReceiptSlabs';
import type { ItemReceiptDraftLine } from '@/lib/itemReceiptForm';

const quantityLine: ItemReceiptDraftLine = {
  purchaseOrderItemId: 'poi-q', lineNumber: 1, itemName: 'Sealer', sku: 'SEAL-1', description: '', unitCode: 'EA',
  qtyOrdered: 10, qtyAlreadyReceived: 0, qtyReceived: '10', qtyRejected: '0', lineNotes: '', tracking: 'quantity', slabs: [],
};

// 3048 x 1524 mm is exactly 10 ft x 5 ft = 50 sq ft.
const slabLine = (slabCount: number): ItemReceiptDraftLine => ({
  purchaseOrderItemId: 'poi-s', lineNumber: 2, itemName: 'Absolute Black', sku: 'AB-30', description: '', unitCode: 'SQFT',
  qtyOrdered: 500, qtyAlreadyReceived: 0, qtyReceived: '', qtyRejected: '0', lineNotes: '', tracking: 'serialized',
  slabs: Array.from({ length: slabCount }, () => newDraftSlab({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30' })),
});

function renderTable(lines: ItemReceiptDraftLine[], extra: Partial<Parameters<typeof ReceiptLinesTable>[0]> = {}) {
  const onChange = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ReceiptLinesTable
        lines={lines} onChange={onChange} lineErrors={[]} serials={{}} warehouseId="wh-1" {...extra}
      />
    </QueryClientProvider>,
  );
  return { onChange };
}

describe('ReceiptLinesTable — quantity lines', () => {
  it('is unchanged: a typed Receiving and Rejected quantity, and no slab editor', () => {
    renderTable([quantityLine]);

    expect(screen.getByRole('spinbutton', { name: 'Quantity receiving for Sealer' })).toHaveValue(10);
    expect(screen.getByRole('spinbutton', { name: 'Quantity rejected for Sealer' })).toBeInTheDocument();
    expect(screen.queryByText(/Slabs for/)).not.toBeInTheDocument();
  });

  it('writes a typed quantity back into the line', async () => {
    const { onChange } = renderTable([{ ...quantityLine, qtyReceived: '' }]);

    await userEvent.setup().type(screen.getByRole('spinbutton', { name: 'Quantity receiving for Sealer' }), '4');

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0][0]).toMatchObject({ qtyReceived: '4' });
  });
});

describe('ReceiptLinesTable — slab lines', () => {
  it('shows the quantity worked out from the slabs, read-only, with no Rejected field', () => {
    renderTable([slabLine(2)]);

    expect(screen.queryByRole('spinbutton', { name: 'Quantity receiving for Absolute Black' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Quantity receiving for Absolute Black, from its slabs')).toHaveTextContent('100.000');
    expect(screen.queryByRole('spinbutton', { name: 'Quantity rejected for Absolute Black' })).not.toBeInTheDocument();
  });

  it('renders the slab editor for the line, with its serials', () => {
    renderTable([slabLine(2)], { serials: { 'poi-s': ['PORD-000012-001', 'PORD-000012-002'] } });

    expect(screen.getByText(/Slabs for Absolute Black/)).toBeInTheDocument();
    expect(screen.getByTestId('slab-serial-1')).toHaveTextContent('PORD-000012-001');
    expect(screen.getByTestId('slab-serial-2')).toHaveTextContent('PORD-000012-002');
  });

  it('adds a slab to the right line and leaves the rest alone', async () => {
    const { onChange } = renderTable([quantityLine, slabLine(0)]);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Add a slab for Absolute Black' }));

    const [first, second] = onChange.mock.calls[0][0] as ItemReceiptDraftLine[];
    expect(first).toEqual(quantityLine);
    expect(second.slabs).toHaveLength(1);
  });

  it('flags a line that is short of a dimension, with every unfinished slab listed', () => {
    const line = slabLine(0);
    renderTable([{ ...line, slabs: [newDraftSlab({ lengthMm: '3048' }), newDraftSlab()] }], {
      lineErrors: [
        { purchaseOrderItemId: 'poi-s', lineNumber: 2, message: 'slab 1: length, width and thickness must all be greater than zero.' },
        { purchaseOrderItemId: 'poi-s', lineNumber: 2, message: 'slab 2: length, width and thickness must all be greater than zero.' },
      ],
    });

    const alert = screen.getByRole('alert');
    expect(within(alert).getAllByRole('listitem')).toHaveLength(2);
    expect(alert).toHaveTextContent('Slab 1: length, width and thickness must all be greater than zero.');
    expect(alert).toHaveTextContent('Slab 2: length, width and thickness must all be greater than zero.');
  });

  it('warns when the slabs add up to more than is outstanding', () => {
    renderTable([{ ...slabLine(11), qtyOrdered: 500, qtyAlreadyReceived: 0 }]); // 550 sq ft > 500
    expect(screen.getByText('Exceeds outstanding')).toBeInTheDocument();
  });

  it('shows a mixed order: a quantity line beside a slab line', () => {
    renderTable([quantityLine, slabLine(1)]);
    expect(screen.getByRole('spinbutton', { name: 'Quantity receiving for Sealer' })).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity receiving for Absolute Black, from its slabs')).toHaveTextContent('50.000');
  });
});

describe('ReceiptLinesTable — units', () => {
  it('says what the ordered quantity is measured in, so "30" is not ambiguous', () => {
    renderTable([{ ...quantityLine, qtyOrdered: 30 }, slabLine(1)]);

    const sealer = screen.getByText('Sealer').closest('tr') as HTMLElement;
    expect(within(sealer).getByText('Each')).toBeInTheDocument();
    const slab = screen.getByText('Absolute Black').closest('tr') as HTMLElement;
    expect(within(slab).getByText('Sq ft')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Unit' })).toBeInTheDocument();
  });

  it('accepts a fractional quantity on a quantity line', () => {
    renderTable([quantityLine]);
    expect(screen.getByRole('spinbutton', { name: 'Quantity receiving for Sealer' })).toHaveAttribute('step', 'any');
    expect(screen.getByRole('spinbutton', { name: 'Quantity rejected for Sealer' })).toHaveAttribute('step', 'any');
  });
});
