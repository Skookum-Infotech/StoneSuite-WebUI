import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { acknowledgeDuplicates, isDuplicateAcknowledged } from '@/lib/documentDuplicateAck';

vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: () => ({ isPrompting: false, confirmLeave: vi.fn(), cancelLeave: vi.fn(), markClean: vi.fn() }),
}));
vi.mock('@/hooks/useItemUnitCode', () => ({ useItemUnitCode: () => () => 'SQFT' }));
vi.mock('@/services/lookupService', () => ({
  lookupService: { getCrmLookups: vi.fn().mockResolvedValue({ countries: [], currencies: [] }) },
}));
vi.mock('@/services/crmService', () => ({
  crmService: {
    getRecord: vi.fn().mockResolvedValue({
      id: 'cust-1',
      coreFields: { customer_name: 'ACME Stone', customer_payment_terms: 'net-30', customer_bill_addr_line1: 'Customer HQ' },
    }),
  },
}));
vi.mock('@/services/attachmentService', () => ({ attachmentService: { listAttachments: vi.fn() } }));
vi.mock('@/services/salesOrderService', () => ({
  salesOrderService: { createOrder: vi.fn(), transition: vi.fn() },
}));
vi.mock('@/services/documentExtractionService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/documentExtractionService');
  return { ...actual, documentExtractionService: { get: vi.fn(), complete: vi.fn(), discard: vi.fn(), list: vi.fn() } };
});
// The real form body pulls in workflow/lookup queries; the page logic under
// test only needs the customer + line state it receives.
vi.mock('./components/SalesOrderFormBody', () => ({
  SalesOrderFormBody: ({ customer, setCustomer, lineItems, data }: {
    customer: { name: string } | null; setCustomer: (c: { id: string; name: string }) => void; lineItems: unknown[];
    data: Record<string, unknown>;
  }) => (
    <div>
      <p data-testid="form-terms">{String(data.payment_terms ?? '')}</p>
      <p data-testid="form-bill">{String(data.bill_address1 ?? '')}</p>
      <p data-testid="form-customer">{customer?.name ?? 'none'}</p>
      <p data-testid="form-lines">{lineItems.length}</p>
      <button type="button" onClick={() => setCustomer({ id: 'c9', name: 'Picked Co' })}>Pick customer in form</button>
    </div>
  ),
}));

import AddSalesOrderPage from './AddSalesOrderPage';
import { salesOrderService } from '@/services/salesOrderService';
import { documentExtractionService as svc } from '@/services/documentExtractionService';
import { toast } from 'sonner';
import { extraction, f, resultDoc } from '@/test/documentExtractionFixtures';
import type { SalesOrder } from '@/types/salesOrder';

const ORDER = { id: 'so-77', salesOrderNumber: 'SO-1043' } as SalesOrder;

function conflict() {
  return new AxiosError('conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 409, statusText: 'Conflict', headers: {}, config: { headers: new AxiosHeaders() },
    data: { success: false, code: 'duplicate_document', message: 'A sales order with this PO number already exists (SO-1000).', existingUuid: 'so-1', existingNumber: 'SO-1000' },
  });
}

/** The header and the footer both carry a Save button; the footer's is the one with the reason in its name. */
const saveButtons = (): HTMLElement[] => screen.getAllByRole('button', { name: /^Save Order/ });

function renderPage(url = '/sales/sales_order/new?fromDocument=ex-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/sales/sales_order/new" element={<AddSalesOrderPage />} />
          <Route path="/sales/sales_order" element={<p>Sales order list</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  vi.mocked(svc.complete).mockResolvedValue(undefined);
  vi.mocked(svc.discard).mockResolvedValue(undefined);
  vi.mocked(svc.list).mockResolvedValue([]);
});

const unresolvedCustomer = resultDoc({
  customer: { uuid: undefined, name: undefined, confidence: 'not_found', candidates: [{ uuid: 'c2', name: 'Acme Stoneworks', active: true, score: 0.8 }] },
});

describe('AddSalesOrderPage review mode', () => {
  it('prefills once from the extraction and shows the review header', async () => {
    vi.mocked(svc.get).mockResolvedValue(extraction(resultDoc()));
    renderPage();
    expect(await screen.findByRole('banner', { name: 'Reviewing PO-4471.pdf' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('form-customer')).toHaveTextContent('ACME Stone'));
    expect(screen.getByTestId('form-lines')).toHaveTextContent('1');
    expect(saveButtons().every((b) => !b.hasAttribute('disabled'))).toBe(true);
  });

  it('loads the resolved customer defaults, but document values win over them', async () => {
    vi.mocked(svc.get).mockResolvedValue(extraction(resultDoc({ header: { billTo: f('12 Main St') } })));
    renderPage();
    // The customer's terms fill what the document left empty ...
    await waitFor(() => expect(screen.getByTestId('form-terms')).toHaveTextContent('net-30'));
    // ... but the address the document supplied stays over the customer's own.
    expect(screen.getByTestId('form-bill')).toHaveTextContent('12 Main St');
  });

  it('does not apply a saved draft when the extraction is unavailable to this user', async () => {
    const { ExtractionApiError } = await import('@/services/documentExtractionService');
    window.sessionStorage.setItem('so-doc-draft:ex-1', JSON.stringify({
      form: { data: { memo: 'leaked' }, lineItems: [], customer: { id: 'x', name: 'Leaked Co' }, customFieldValues: {} },
      reviewed: [], extras: { expectedDelivery: '', shippingCharge: 0, adjustment: 0 },
    }));
    vi.mocked(svc.get).mockRejectedValue(new ExtractionApiError(404, 'not found'));
    renderPage();
    expect(await screen.findByText(/no longer available/)).toBeInTheDocument();
    expect(screen.getByTestId('form-customer')).toHaveTextContent('none');
  });

  it('keeps Save disabled with a reason until the customer is resolved', async () => {
    vi.mocked(svc.get).mockResolvedValue(extraction(unresolvedCustomer));
    renderPage();
    const save = await screen.findByRole('button', { name: /Save Order\. Disabled: 1 item needs review/ });
    expect(save).toBeDisabled();
    expect(saveButtons().every((b) => b.hasAttribute('disabled'))).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Use customer Acme Stoneworks' }));
    await waitFor(() => expect(saveButtons().every((b) => !b.hasAttribute('disabled'))).toBe(true));
    expect(screen.getByTestId('form-customer')).toHaveTextContent('Acme Stoneworks');
  });

  it('offers Create anyway on a 409 duplicate and resubmits with allowDuplicate', async () => {
    vi.mocked(svc.get).mockResolvedValue(extraction(resultDoc()));
    vi.mocked(salesOrderService.createOrder).mockRejectedValueOnce(conflict()).mockResolvedValueOnce(ORDER);
    renderPage();
    await screen.findByRole('banner', { name: /Reviewing/ });
    await waitFor(() => expect(screen.getByTestId('form-lines')).toHaveTextContent('1'));
    await userEvent.click(saveButtons()[0]);

    expect(await screen.findByText('This order may already exist')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open existing SO-1000' })).toBeInTheDocument();
    expect(vi.mocked(salesOrderService.createOrder).mock.calls[0][0]).not.toHaveProperty('allowDuplicate');

    await userEvent.click(screen.getByRole('button', { name: 'Create anyway' }));
    await waitFor(() => expect(salesOrderService.createOrder).toHaveBeenCalledTimes(2));
    expect(vi.mocked(salesOrderService.createOrder).mock.calls[1][0]).toMatchObject({ allowDuplicate: true, customerUuid: 'cust-1' });

    // Success: server told what was saved, toast names the file, we leave for the list.
    await waitFor(() => expect(svc.complete).toHaveBeenCalledWith('ex-1', expect.objectContaining({
      recordUuid: 'so-77',
      saved: expect.objectContaining({ customerUuid: 'cust-1', poNumber: 'PO-4471', lines: [{ docSku: 'QZ-3CM', docDescription: 'Quartz slab 3cm', itemUuid: 'item-1' }] }),
    })));
    expect(toast.success).toHaveBeenCalledWith('Sales Order SO-1043 created from PO-4471.pdf', expect.anything());
    expect(await screen.findByText('Sales order list')).toBeInTheDocument();
  });

  it.each([
    { name: 'skips the second prompt for the order accepted on upload', ack: 'so-1', prompted: false },
    { name: 'still asks when the 409 names a different order', ack: 'so-9', prompted: true },
  ])('$name', async ({ ack, prompted }) => {
    acknowledgeDuplicates('ex-1', [ack]);
    vi.mocked(svc.get).mockResolvedValue(extraction(resultDoc()));
    vi.mocked(salesOrderService.createOrder).mockRejectedValueOnce(conflict()).mockResolvedValueOnce(ORDER);
    renderPage();
    await screen.findByRole('banner', { name: /Reviewing/ });
    await waitFor(() => expect(screen.getByTestId('form-lines')).toHaveTextContent('1'));
    await userEvent.click(saveButtons()[0]);

    if (prompted) {
      expect(await screen.findByText('This order may already exist')).toBeInTheDocument();
      expect(salesOrderService.createOrder).toHaveBeenCalledTimes(1);
      return;
    }
    await waitFor(() => expect(salesOrderService.createOrder).toHaveBeenCalledTimes(2));
    expect(vi.mocked(salesOrderService.createOrder).mock.calls[1][0]).toMatchObject({ allowDuplicate: true });
    expect(screen.queryByText('This order may already exist')).not.toBeInTheDocument();
    await waitFor(() => expect(isDuplicateAcknowledged('ex-1', 'so-1')).toBe(false));
  });

  it('notes the learned customer alias when the user picked a different customer', async () => {
    vi.mocked(svc.get).mockResolvedValue(extraction(resultDoc()));
    vi.mocked(salesOrderService.createOrder).mockResolvedValue(ORDER);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Pick customer in form' }));
    await userEvent.click(saveButtons()[0]);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(vi.mocked(toast.success).mock.calls[0][1]).toMatchObject({
      description: "We'll remember ACME Stone Inc → Picked Co next time.",
    });
  });

  it('shows the expired banner and keeps the form usable', async () => {
    const { ExtractionApiError } = await import('@/services/documentExtractionService');
    vi.mocked(svc.get).mockRejectedValue(new ExtractionApiError(404, 'expired', 'expired'));
    renderPage();
    expect(await screen.findByText(/Source document expired after 24 h/)).toBeInTheDocument();
    expect(saveButtons()[0]).toBeEnabled();
  });

  it('discards after confirmation and returns to the list', async () => {
    vi.mocked(svc.get).mockResolvedValue(extraction(resultDoc()));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Discard this document and its changes' }));
    await userEvent.click(await screen.findByRole('button', { name: /Discard changes/ }));
    await waitFor(() => expect(svc.discard).toHaveBeenCalledWith('ex-1'));
    expect(await screen.findByText('Sales order list')).toBeInTheDocument();
  });

  it('leaves manual create untouched without ?fromDocument', async () => {
    renderPage('/sales/sales_order/new');
    expect((await screen.findAllByRole('button', { name: 'Save Order' })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('banner', { name: /Reviewing/ })).not.toBeInTheDocument();
    expect(svc.get).not.toHaveBeenCalled();
  });
});
