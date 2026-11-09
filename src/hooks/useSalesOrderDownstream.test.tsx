import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSalesOrderDownstream } from './useSalesOrderDownstream';

const SO = { id: 'so-1', number: 'SO-1', customerName: 'Acme' };

const mocks = vi.hoisted(() => ({ searchInvoices: vi.fn(), searchJobs: vi.fn(), searchPayments: vi.fn() }));
vi.mock('@/services/invoiceService', () => ({ invoiceService: { searchInvoices: mocks.searchInvoices } }));
vi.mock('@/services/paymentService', () => ({ paymentService: { searchPayments: mocks.searchPayments } }));
vi.mock('@/services/fabricationService', () => ({ fabricationService: { searchJobs: mocks.searchJobs } }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useSalesOrderDownstream', () => {
  it('keeps only invoices, jobs and payments that point back at the order', async () => {
    mocks.searchInvoices.mockResolvedValue({ records: [
      { id: 'i1', invoiceNumber: 'INV-1', statusCode: 'SENT', status: 'Sent', salesOrder: { id: 'so-1', number: 'SO-1' } },
      { id: 'i2', invoiceNumber: 'INV-2', statusCode: 'SENT', status: 'Sent', salesOrder: { id: 'other', number: 'SO-9' } },
    ] });
    mocks.searchJobs.mockResolvedValue({ records: [
      { id: 'j1', jobNumber: 'FAB-1', statusCode: 'DRFT', status: 'Draft', salesOrderId: 'so-1' },
      { id: 'j2', jobNumber: 'FAB-2', statusCode: 'DRFT', status: 'Draft', salesOrderId: 'other' },
    ] });
    mocks.searchPayments.mockResolvedValue({ records: [
      { id: 'p1', paymentNumber: 'PAY-1', statusCode: 'APPL', status: 'Applied', applications: [{ id: 'a', invoiceId: 'i1', invoiceNumber: 'INV-1', amount: 5, createdAt: '' }] },
      { id: 'p2', paymentNumber: 'PAY-2', statusCode: 'APPL', status: 'Applied', applications: [{ id: 'b', invoiceId: 'i2', invoiceNumber: 'INV-2', amount: 5, createdAt: '' }] },
      { id: 'p3', paymentNumber: 'PAY-3', statusCode: 'RCVD', status: 'Received' },
    ] });
    const { result } = renderHook(() => useSalesOrderDownstream(SO), { wrapper });
    await waitFor(() => expect(result.current.invoice).toBeDefined());
    await waitFor(() => expect(result.current.fabrication).toBeDefined());
    await waitFor(() => expect(result.current.payment).toBeDefined());
    expect(result.current.payment).toEqual([{ id: 'p1', number: 'PAY-1', statusCode: 'APPL', status: 'Applied' }]);
    expect(result.current.invoice).toEqual([{ id: 'i1', number: 'INV-1', statusCode: 'SENT', status: 'Sent' }]);
    expect(result.current.fabrication).toEqual([{ id: 'j1', number: 'FAB-1', statusCode: 'DRFT', status: 'Draft' }]);
  });

  it('searches nothing until the order has loaded', () => {
    mocks.searchInvoices.mockClear();
    renderHook(() => useSalesOrderDownstream({}), { wrapper });
    expect(mocks.searchInvoices).not.toHaveBeenCalled();
  });
});
