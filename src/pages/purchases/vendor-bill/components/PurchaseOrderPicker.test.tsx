import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/purchaseOrderService', () => ({
  purchaseOrderService: { searchPurchaseOrders: vi.fn() },
}));

import { PurchaseOrderPicker } from './PurchaseOrderPicker';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import type { PurchaseOrderPage, PurchaseOrderSummary } from '@/types/purchaseOrder';

const VENDOR = { id: 'v-1', name: 'Marble Supply Co' };
// A person vendor: the picked vendor's display name carries the honorific, but
// the name stored on their orders does not — a name search finds nothing.
const PERSON_VENDOR = { id: 'v-9', name: 'Mrs Stella Sosa' };
const SEARCH_LABEL = 'Search purchase order';

function po(id: string, number: string, status = 'Sent'): PurchaseOrderSummary {
  return {
    id, purchaseOrderNumber: number, status, statusCode: 'SENT', approvalStatus: 'none',
    vendor: { id: VENDOR.id, name: VENDOR.name },
    orderDate: '2026-09-01', grandTotal: 100, ownerEmployeeId: null,
  };
}

function page(records: PurchaseOrderSummary[]): PurchaseOrderPage {
  return { records, nextCursor: '', hasMore: false, scope: 'all' };
}

function renderPicker(props: Partial<Parameters<typeof PurchaseOrderPicker>[0]> = {}) {
  const onChange = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PurchaseOrderPicker vendor={VENDOR} value={null} onChange={onChange} {...props} />
    </QueryClientProvider>,
  );
  return { onChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(purchaseOrderService.searchPurchaseOrders).mockResolvedValue(
    page([po('po-1', 'PORD-000001', 'Sent'), po('po-3', 'PORD-000003', 'Draft')]),
  );
});

describe('PurchaseOrderPicker', () => {
  it('is disabled until a vendor is chosen, and never queries', () => {
    renderPicker({ vendor: null });
    const input = screen.getByLabelText(SEARCH_LABEL);
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('placeholder', 'Select a vendor first…');
    expect(purchaseOrderService.searchPurchaseOrders).not.toHaveBeenCalled();
  });

  it("lists the vendor's orders of any status", async () => {
    renderPicker();
    await userEvent.click(screen.getByLabelText(SEARCH_LABEL));

    expect(await screen.findByText('PORD-000001')).toBeInTheDocument();
    expect(screen.getByText('PORD-000003')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it("pins the vendor with an exact filter on the vendor's id", async () => {
    renderPicker();
    await userEvent.click(screen.getByLabelText(SEARCH_LABEL));
    await screen.findByText('PORD-000001');

    expect(purchaseOrderService.searchPurchaseOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [{ field: 'vendor_uuid', op: 'eq', value: VENDOR.id }],
        search: undefined,
      }),
    );
  });

  it("never searches by the vendor's name, so a person vendor's honorific cannot hide their orders", async () => {
    renderPicker({ vendor: PERSON_VENDOR });
    await userEvent.click(screen.getByLabelText(SEARCH_LABEL));
    await screen.findByText('PORD-000001');

    const [request] = vi.mocked(purchaseOrderService.searchPurchaseOrders).mock.calls[0];
    expect(request.search).toBeUndefined();
    expect(JSON.stringify(request)).not.toContain('Stella');
    expect(request.filters).toEqual([{ field: 'vendor_uuid', op: 'eq', value: PERSON_VENDOR.id }]);
  });

  it('passes a typed PO number to the server as the search term, still pinned to the vendor', async () => {
    vi.mocked(purchaseOrderService.searchPurchaseOrders).mockImplementation(async (req) =>
      page(req.search ? [po('po-3', 'PORD-000003', 'Draft')] : [po('po-1', 'PORD-000001'), po('po-3', 'PORD-000003', 'Draft')]),
    );
    renderPicker();
    await userEvent.type(screen.getByLabelText(SEARCH_LABEL), '000003');

    // The narrowed query only lands once the 300ms search debounce settles,
    // and the list is briefly empty while it loads — so wait for the final
    // state (only the match) rather than for the other row to merely vanish.
    await waitFor(() => {
      expect(screen.getByText('PORD-000003')).toBeInTheDocument();
      expect(screen.queryByText('PORD-000001')).not.toBeInTheDocument();
    });
    expect(purchaseOrderService.searchPurchaseOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filters: [{ field: 'vendor_uuid', op: 'eq', value: VENDOR.id }],
        search: '000003',
      }),
    );
  });

  it('reports only {id, number} when an order is picked', async () => {
    const { onChange } = renderPicker();
    await userEvent.click(screen.getByLabelText(SEARCH_LABEL));
    await userEvent.click(await screen.findByLabelText('Link purchase order PORD-000001'));

    expect(onChange).toHaveBeenCalledWith({ id: 'po-1', number: 'PORD-000001' });
  });

  it('says so when the vendor has no purchase orders', async () => {
    vi.mocked(purchaseOrderService.searchPurchaseOrders).mockResolvedValue(page([]));
    renderPicker();
    await userEvent.click(screen.getByLabelText(SEARCH_LABEL));

    expect(await screen.findByText('No purchase orders for this vendor.')).toBeInTheDocument();
  });

  it('shows the failure, not "no purchase orders", when the search fails', async () => {
    vi.mocked(purchaseOrderService.searchPurchaseOrders).mockRejectedValue(new Error('You do not have permission to read purchase orders.'));
    renderPicker();
    await userEvent.click(screen.getByLabelText(SEARCH_LABEL));

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to read purchase orders.');
    expect(screen.queryByText('No purchase orders for this vendor.')).not.toBeInTheDocument();
  });

  it('shows the linked order and clears it on remove', async () => {
    const { onChange } = renderPicker({ value: { id: 'po-1', number: 'PORD-000001' } });

    expect(screen.getByText('PORD-000001')).toBeInTheDocument();
    expect(screen.queryByLabelText(SEARCH_LABEL)).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Remove purchase order link'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
