import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/documentExtractionService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/documentExtractionService');
  return {
    ...actual,
    documentExtractionService: { get: vi.fn(), complete: vi.fn().mockResolvedValue(undefined), discard: vi.fn().mockResolvedValue(undefined) },
  };
});

import { useDocumentReviewMode } from './useDocumentReviewMode';
import type { DocumentReviewAdapter } from './documentReviewModeTypes';
import type { DocumentHandoffBase } from '@/lib/documentHandoffShared';
import { documentExtractionService as svc } from '@/services/documentExtractionService';
import { extraction, resultDoc } from '@/test/documentExtractionFixtures';

interface FakeForm { vendor: { id: string; name: string } | null; note: string }
interface FakeExtras { fee: number }
type FakeHandoff = DocumentHandoffBase;
type Fake = DocumentReviewAdapter<FakeForm, Partial<FakeForm>, FakeExtras, FakeHandoff, { id: string; name: string }, { id: string }, { reference: string }>;

function fakeAdapter(applyParty = vi.fn()): Fake {
  return {
    docType: 'vendor_bill',
    partyReviewKey: 'vendor',
    duplicateMessage: 'dup',
    initialExtras: { fee: 0 },
    buildHandoff: () => ({ lines: [], provenance: {}, reviewItems: [] }),
    extrasOf: () => ({ fee: 5 }),
    prefill: () => ({ note: 'prefilled', vendor: { id: 'v1', name: 'Acme' } }),
    mergeDraft: (draft) => draft,
    toPatch: (form) => form,
    resolvedParty: () => ({ id: 'v1', name: 'Acme' }),
    formParty: (form) => form.vendor,
    usePartyRecord: () => ({ data: undefined }),
    applyParty,
    lineHasItem: () => undefined,
    lineStats: () => ({ amounts: new Map([['a', 10]]), tax: 0 }),
    unitChecks: () => [],
    extrasAmount: (e) => e.fee,
    payloadExtras: (_e, allow) => ({ reference: allow ? 'allowed' : 'plain' }),
    completeInput: (r) => ({ recordUuid: r.id, saved: { customerUuid: '', poNumber: '', orderDate: '', lines: [] } }),
    createdSummary: (r) => ({ recordId: r.id, title: 'Vendor Bill created' }),
  };
}

function wrapper(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><MemoryRouter initialEntries={[url]}>{children}</MemoryRouter></QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe('useDocumentReviewMode (fake adapter)', () => {
  const form: FakeForm = { vendor: null, note: '' };

  it('is inert without ?fromDocument', () => {
    const adapter = fakeAdapter();
    const { result } = renderHook(
      () => useDocumentReviewMode({ adapter, form, apply: vi.fn() }),
      { wrapper: wrapper('/purchases/vendor_bill/new') },
    );
    expect(result.current.active).toBe(false);
    expect(result.current.payloadExtras(true)).toEqual({});
    expect(svc.get).not.toHaveBeenCalled();
  });

  it('prefills once through the adapter and exposes its extras', async () => {
    vi.mocked(svc.get).mockResolvedValue(extraction(resultDoc(), { docType: 'vendor_bill' }));
    const adapter = fakeAdapter();
    const apply = vi.fn();
    const { result } = renderHook(
      () => useDocumentReviewMode({ adapter, form, apply }),
      { wrapper: wrapper('/purchases/vendor_bill/new?fromDocument=ex-1') },
    );
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith({ note: 'prefilled', vendor: { id: 'v1', name: 'Acme' } });
    expect(result.current.extras).toEqual({ fee: 5 });
    expect(result.current.preTaxTotal).toBe(15);
    expect(result.current.payloadExtras(true)).toEqual({ reference: 'allowed' });
    expect(result.current.docType).toBe('vendor_bill');
  });

  it('picking a party delegates to the adapter and marks the party row reviewed', async () => {
    vi.mocked(svc.get).mockResolvedValue(extraction(resultDoc(), { docType: 'vendor_bill' }));
    const applyParty = vi.fn();
    const adapter = fakeAdapter(applyParty);
    const { result } = renderHook(
      () => useDocumentReviewMode({ adapter, form, apply: vi.fn() }),
      { wrapper: wrapper('/purchases/vendor_bill/new?fromDocument=ex-1') },
    );
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => result.current.pickParty({ id: 'v2', name: 'Other' }));
    expect(applyParty).toHaveBeenCalledWith({ id: 'v2', name: 'Other' }, expect.anything());
    expect(result.current.reviewed.has('vendor')).toBe(true);
  });

  it('afterCreate completes the extraction with the adapter input', async () => {
    vi.mocked(svc.get).mockResolvedValue(extraction(resultDoc(), { docType: 'vendor_bill' }));
    const adapter = fakeAdapter();
    const { result } = renderHook(
      () => useDocumentReviewMode({ adapter, form, apply: vi.fn() }),
      { wrapper: wrapper('/purchases/vendor_bill/new?fromDocument=ex-1') },
    );
    await waitFor(() => expect(result.current.handoff).not.toBeNull());
    await act(async () => { await result.current.afterCreate({ id: 'bill-1' }); });
    expect(svc.complete).toHaveBeenCalledWith('ex-1', expect.objectContaining({ recordUuid: 'bill-1' }));
  });
});
