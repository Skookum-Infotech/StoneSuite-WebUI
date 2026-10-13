import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/inventoryService', () => ({
  inventoryService: { searchItems: vi.fn(), searchKits: vi.fn(), getKit: vi.fn() },
}));
vi.mock('@/hooks/useItemUnitCode', () => ({ useItemUnitCode: () => () => 'SQFT' }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

import { QuoteItemsTab } from './QuoteItemsTab';
import { SalesOrderItemsTab } from './SalesOrderItemsTab';
import type { QuoteLineItem } from '@/lib/quoteForm';
import type { SOLineItem } from '@/lib/salesOrderForm';

// The fixtures below carry dimensionUnit 'cm' unless a test says otherwise (inches
// are the default). 304.8 x 152.4 cm is exactly 10 ft x 5 ft = 50 sq ft.
const LENGTH_CM = '304.8';
const WIDTH_CM = '152.4';

function quoteLine(over: Partial<QuoteLineItem> = {}): QuoteLineItem {
  return {
    id: 'q-1', lineNo: 1, itemName: 'Calacatta', itemDescription: '', itemSku: 'CAL-1', units: 'SQFT',
    quantity: '1', unitPrice: '10', discount: '0', amount: '10.00', total: '10.00',
    inventoryItemUuid: 'i-cal', dimensionUnit: 'cm', ...over,
  };
}

function soLine(over: Partial<SOLineItem> = {}): SOLineItem {
  return {
    id: 's-1', lineNo: 1, itemName: 'Calacatta', itemDescription: '', itemSku: 'CAL-1', units: 'SQFT',
    quantity: '1', unitPrice: '10', discount: '0', amount: '10.00', tax: '0', total: '10.00',
    inventoryItemUuid: 'i-cal', dimensionUnit: 'cm', ...over,
  };
}

function QuoteHarness({ initial }: { initial: QuoteLineItem[] }) {
  const [items, setItems] = useState<QuoteLineItem[]>(initial);
  return <QuoteItemsTab items={items} onUpdate={setItems} headerTaxPercent={0} />;
}

function OrderHarness({ initial }: { initial: SOLineItem[] }) {
  const [items, setItems] = useState<SOLineItem[]>(initial);
  return <SalesOrderItemsTab items={items} onUpdate={setItems} />;
}

function renderWith(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Quote items table — slab length, width and count', () => {
  it('works the quantity and amount out from length x width x slabs', async () => {
    const user = userEvent.setup();
    renderWith(<QuoteHarness initial={[quoteLine()]} />);

    await user.click(screen.getByRole('button', { name: 'Edit line Calacatta' }));
    await user.type(screen.getByRole('textbox', { name: 'Length (cm)' }), LENGTH_CM);
    await user.type(screen.getByRole('textbox', { name: 'Width (cm)' }), WIDTH_CM);
    await user.type(screen.getByRole('textbox', { name: 'Slabs' }), '3');

    const qty = screen.getByRole('spinbutton', { name: 'Quantity' });
    expect(qty).toHaveValue(150); // 3 slabs x 50 sq ft
    expect(qty).toHaveAttribute('readonly'); // worked out, not typed
    // 150 sq ft x $10.00 per sq ft.
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveValue('$1500.00');
  });

  it('counts a blank slab count as one slab', async () => {
    const user = userEvent.setup();
    renderWith(<QuoteHarness initial={[quoteLine()]} />);

    await user.click(screen.getByRole('button', { name: 'Edit line Calacatta' }));
    await user.type(screen.getByRole('textbox', { name: 'Length (cm)' }), LENGTH_CM);
    await user.type(screen.getByRole('textbox', { name: 'Width (cm)' }), WIDTH_CM);

    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue(50);
  });

  it('gives the quantity back to the user once the size is cleared', async () => {
    const user = userEvent.setup();
    renderWith(<QuoteHarness initial={[quoteLine()]} />);

    await user.click(screen.getByRole('button', { name: 'Edit line Calacatta' }));
    await user.type(screen.getByRole('textbox', { name: 'Length (cm)' }), LENGTH_CM);
    await user.type(screen.getByRole('textbox', { name: 'Width (cm)' }), WIDTH_CM);
    await user.clear(screen.getByRole('textbox', { name: 'Length (cm)' }));

    const qty = screen.getByRole('spinbutton', { name: 'Quantity' });
    expect(qty).not.toHaveAttribute('readonly');
    await user.clear(qty);
    await user.type(qty, '12');
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveValue('$120.00');
  });

  it('shows the saved size and slab count in the row', async () => {
    renderWith(<QuoteHarness initial={[quoteLine({ length: '300', width: '150', slabs: '2', quantity: '96.875' })]} />);

    const row = screen.getByRole('row', { name: /Calacatta/ });
    expect(row).toHaveTextContent('300');
    expect(row).toHaveTextContent('150');
    expect(row).toHaveTextContent('96.875');
  });

  it('measures a line in the unit it carries', async () => {
    const user = userEvent.setup();
    // 10 x 5 feet is exactly 50 sq ft, so two slabs are 100 sq ft = $1000.00.
    renderWith(<QuoteHarness initial={[quoteLine({ dimensionUnit: 'ft' })]} />);

    await user.click(screen.getByRole('button', { name: 'Edit line Calacatta' }));
    expect(screen.queryByRole('textbox', { name: 'Length (cm)' })).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Length (ft)' }), '10');
    await user.type(screen.getByRole('textbox', { name: 'Width (ft)' }), '5');
    await user.type(screen.getByRole('textbox', { name: 'Slabs' }), '2');

    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue(100);
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveValue('$1000.00');
  });

  it('measures a line in inches when it carries no unit', async () => {
    const user = userEvent.setup();
    // Inches are the default: 120 x 60 in is exactly 50 sq ft, so one slab is $500.00.
    renderWith(<QuoteHarness initial={[quoteLine({ dimensionUnit: undefined })]} />);

    await user.click(screen.getByRole('button', { name: 'Edit line Calacatta' }));
    await user.type(screen.getByRole('textbox', { name: 'Length (in)' }), '120');
    await user.type(screen.getByRole('textbox', { name: 'Width (in)' }), '60');

    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue(50);
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveValue('$500.00');
  });

  it('shows the saved size with its unit', () => {
    renderWith(<QuoteHarness initial={[quoteLine({ length: '120', width: '60', slabs: '2', quantity: '100', dimensionUnit: 'in' })]} />);

    const row = screen.getByRole('row', { name: /Calacatta/ });
    expect(row).toHaveTextContent('120 in');
    expect(row).toHaveTextContent('60 in');
  });

  it('does not offer dimensions on a line measured in each', async () => {
    const user = userEvent.setup();
    renderWith(<QuoteHarness initial={[quoteLine({ units: 'EA', itemName: 'Faucet' })]} />);

    await user.click(screen.getByRole('button', { name: 'Edit line Faucet' }));

    expect(screen.getByRole('textbox', { name: 'Length (cm)' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Width (cm)' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Slabs' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).not.toHaveAttribute('readonly');
  });
});

describe('Quote items table — Enter in a line box', () => {
  it('never saves the document the table sits in', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    renderWith(
      <form onSubmit={onSubmit}>
        <QuoteHarness initial={[quoteLine()]} />
        <button type="submit">Save order</button>
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Edit line Calacatta' }));
    await user.type(screen.getByRole('textbox', { name: 'Length (cm)' }), '30{Enter}');
    await user.type(screen.getByRole('spinbutton', { name: 'Unit Price' }), '9{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('Sales order items table — slab length, width and count', () => {
  it('works the quantity out the same way, with the dimensions ahead of Qty', async () => {
    const user = userEvent.setup();
    renderWith(<OrderHarness initial={[soLine()]} />);

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers.indexOf('L')).toBe(headers.indexOf('SKU') + 1);
    expect(headers.indexOf('Qty')).toBeGreaterThan(headers.indexOf('Slabs'));

    await user.click(screen.getByRole('button', { name: 'Edit line Calacatta' }));
    await user.type(screen.getByRole('textbox', { name: 'Length (cm)' }), LENGTH_CM);
    await user.type(screen.getByRole('textbox', { name: 'Width (cm)' }), WIDTH_CM);
    await user.type(screen.getByRole('textbox', { name: 'Slabs' }), '2');

    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue(100);
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveValue('$1000.00');
  });
});
