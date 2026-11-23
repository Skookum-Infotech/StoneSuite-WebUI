import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
const order = vi.fn();
vi.mock('@/hooks/useOrderShortageItems', () => ({ useOrderShortageItems: () => ({ order, isPending: false }) }));

import { StockShortageBanner } from './StockShortageBanner';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { StockShortage } from '@/types/salesOrder';

const GRN: StockShortage = { itemId: 'i-1', sku: 'GRN', name: 'Granite', unitCode: 'SQFT', requested: 156.25, available: 0, short: 156.25 };
const MRB: StockShortage = { itemId: 'i-2', sku: 'MRB', name: 'Marble', unitCode: 'SQFT', requested: 312.5, available: 0, short: 312.5 };

function allow(canCreatePO: boolean) {
  vi.mocked(useUserPermissions).mockReturnValue({
    isLoading: false,
    hasPermission: (resource: string, action: string) => canCreatePO && resource === 'purchase_order' && action === 'create',
  } as unknown as ReturnType<typeof useUserPermissions>);
}

beforeEach(() => {
  vi.clearAllMocks();
  allow(true);
});

describe('StockShortageBanner', () => {
  it('says which items are short, by how much, and that delivery may be delayed', () => {
    render(<StockShortageBanner orderNumber="SO-1042" shortages={[GRN, MRB]} />);

    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent('2 items short: delivery may be delayed');
    expect(banner).toHaveTextContent(
      "SO-1042 was created, but inventory doesn't cover GRN (short 156.25 sq ft) and MRB (short 312.5 sq ft).",
    );
    expect(banner).toHaveTextContent('Delivery will be delayed until this stock is received.');
  });

  it('opens a purchase order for exactly the short items', async () => {
    const user = userEvent.setup();
    render(<StockShortageBanner orderNumber="SO-1042" shortages={[GRN, MRB]} />);

    await user.click(screen.getByRole('button', { name: 'Order shortage items on a new purchase order' }));

    expect(order).toHaveBeenCalledWith([GRN, MRB]);
  });

  it('hides the order button from someone who cannot create purchase orders', () => {
    allow(false);
    render(<StockShortageBanner orderNumber="SO-1042" shortages={[GRN]} />);

    expect(screen.getByRole('alert')).toHaveTextContent('1 item short');
    expect(screen.queryByRole('button', { name: /Order shortage items/ })).not.toBeInTheDocument();
  });

  it('can be dismissed', async () => {
    const user = userEvent.setup();
    render(<StockShortageBanner orderNumber="SO-1042" shortages={[GRN]} />);

    await user.click(screen.getByRole('button', { name: 'Dismiss the stock shortage warning' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('orders only what no sent purchase order covers, and says what is already on order', async () => {
    const user = userEvent.setup();
    const partly: StockShortage = { ...MRB, available: 0, onOrder: 200, short: 112.5, purchaseOrders: ['PORD-000012'] };
    render(<StockShortageBanner orderNumber="SO-1042" shortages={[GRN, partly]} />);

    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent('2 items short');
    expect(banner).toHaveTextContent('GRN (short 156.25 sq ft) and MRB (short 112.5 sq ft)');
    expect(banner).toHaveTextContent('Already on order: MRB (200 sq ft on PORD-000012).');
    await user.click(screen.getByRole('button', { name: 'Order shortage items on a new purchase order' }));
    expect(order).toHaveBeenCalledWith([GRN, partly]);
  });

  it('turns into a quiet on-order note once sent purchase orders cover everything', () => {
    const covered: StockShortage = { ...GRN, onOrder: 156.25, short: 0, purchaseOrders: ['PORD-000012'] };
    render(<StockShortageBanner orderNumber="SO-1042" shortages={[covered]} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const note = screen.getByRole('status');
    expect(note).toHaveTextContent('Stock on order: delivery waits for it to arrive');
    expect(note).toHaveTextContent('SO-1042 is covered by stock on its way: GRN (156.25 sq ft on PORD-000012).');
    expect(screen.queryByRole('button', { name: /Order shortage items/ })).not.toBeInTheDocument();
  });

  it('shows nothing when the order is covered', () => {
    render(<StockShortageBanner orderNumber="SO-1042" shortages={[]} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
