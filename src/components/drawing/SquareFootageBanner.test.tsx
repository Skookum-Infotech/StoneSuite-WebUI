import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DrawingArea, Piece } from '@/types/drawing';
import type { SalesOrder, SalesOrderLine } from '@/types/salesOrder';

vi.mock('@/services/salesOrderService', () => ({
  salesOrderService: { updateOrder: vi.fn() },
}));

import { salesOrderService } from '@/services/salesOrderService';
import { SquareFootageBanner } from './SquareFootageBanner';

function piece(overrides: Partial<Piece> = {}): Piece {
  return {
    id: 'p1',
    label: 'A-1',
    shape: 'rect',
    // 10ft x 6ft = 60 sq ft (3048mm x 1828.8mm)
    outline: [{ x: 0, y: 0 }, { x: 3048, y: 0 }, { x: 3048, y: -1828.8 }, { x: 0, y: -1828.8 }],
    position: { x: 0, y: 0 },
    rotationDeg: 0,
    thicknessMm: 30,
    edges: [],
    seams: [],
    cutouts: [],
    ...overrides,
  };
}

function area(pieces: Piece[]): DrawingArea {
  return { id: 'a1', name: 'Area 1', code: '', sortOrder: 0, pieces, cabinets: [], notes: [] };
}

function line(overrides: Partial<SalesOrderLine> = {}): SalesOrderLine {
  return {
    id: 'line-1', lineNumber: 1, sku: 'GRN', itemName: 'Granite', description: '', unitCode: 'SQFT',
    quantity: 50, unitPrice: 10, discountPercent: 0, taxPercent: 0, lineSubtotal: 0, lineDiscount: 0,
    lineTax: 0, lineTotal: 0, fulfilledQuantity: 0, status: 'open', ...overrides,
  };
}

function order(overrides: Partial<SalesOrder> = {}): SalesOrder {
  return {
    id: 'so-1', salesOrderNumber: 'SO-1', status: 'Open', statusCode: 'OPEN', approvalStatus: 'none',
    nextStatusCodes: [], gated: false, approvers: [], requiredApprovals: 0, approvedCount: 0,
    canApprove: false, isOverride: false, callerAlreadyApproved: false,
    customer: { id: 'cust-1', name: 'Acme' }, orderDate: '2026-11-01', scheduledInstallDate: '2026-11-15',
    paymentTermsId: null, priceLevelId: null, currencyId: null, salesRepEmployeeId: null,
    ownerEmployeeId: null, salesTaxPercent: 0, shipSameAsBilling: true, billing: {}, shipping: {},
    subtotal: 0, discountTotal: 0, taxTotal: 0, shippingCharge: 0, adjustment: 0, grandTotal: 0,
    items: [line()], ...overrides,
  } as SalesOrder;
}

describe('SquareFootageBanner', () => {
  it('renders nothing when every referenced line matches the drawing\'s sq ft', () => {
    const { container } = render(
      <SquareFootageBanner areas={[area([piece({ salesOrderLineId: 'line-1' })])]} order={order({ items: [line({ quantity: 60 })] })} onLineUpdated={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a line with a non-area unit code, even if referenced by pieces', () => {
    const { container } = render(
      <SquareFootageBanner areas={[area([piece({ salesOrderLineId: 'line-1' })])]} order={order({ items: [line({ unitCode: 'EACH', quantity: 1 })] })} onLineUpdated={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a line no piece references', () => {
    const { container } = render(
      <SquareFootageBanner areas={[area([piece({ salesOrderLineId: undefined })])]} order={order({ items: [line({ quantity: 999 })] })} onLineUpdated={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a mismatch banner naming both sq ft figures', () => {
    render(
      <SquareFootageBanner areas={[area([piece({ salesOrderLineId: 'line-1' })])]} order={order({ items: [line({ quantity: 50 })] })} onLineUpdated={vi.fn()} />,
    );
    expect(screen.getByText(/60\.0 sq ft/)).toBeDefined();
    expect(screen.getByText(/50\.0 sq ft/)).toBeDefined();
  });

  it('clicking "Update line" sends only that line\'s quantity changed, keeping everything else, then calls onLineUpdated', async () => {
    const theOrder = order({ items: [line({ quantity: 50 })] });
    const saved = order({ items: [line({ quantity: 60 })] });
    vi.mocked(salesOrderService.updateOrder).mockResolvedValue(saved);
    const onLineUpdated = vi.fn();
    render(<SquareFootageBanner areas={[area([piece({ salesOrderLineId: 'line-1' })])]} order={theOrder} onLineUpdated={onLineUpdated} />);

    await userEvent.click(screen.getByRole('button', { name: /update line/i }));

    expect(salesOrderService.updateOrder).toHaveBeenCalledTimes(1);
    const [uuid, payload] = vi.mocked(salesOrderService.updateOrder).mock.calls[0];
    expect(uuid).toBe('so-1');
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].quantity).toBeCloseTo(60, 1);
    expect(payload.scheduledInstallDate).toBe('2026-11-15'); // unrelated fields preserved
    expect(onLineUpdated).toHaveBeenCalledWith(saved);
  });
});
