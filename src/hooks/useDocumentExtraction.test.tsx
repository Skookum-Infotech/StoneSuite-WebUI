import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/documentExtractionService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/documentExtractionService');
  return {
    ...actual,
    sha256Hex: vi.fn().mockResolvedValue('abc123'),
    documentExtractionService: {
      create: vi.fn(), presign: vi.fn(), upload: vi.fn(), start: vi.fn(),
      get: vi.fn(), list: vi.fn(), notify: vi.fn(), discard: vi.fn(), complete: vi.fn(),
    },
  };
});

import { useDocumentExtraction } from './useDocumentExtraction';
import { documentExtractionService as svc, ExtractionApiError } from '@/services/documentExtractionService';
import { UploadError } from '@/services/attachmentService';
import type { DocumentExtraction } from '@/types/documentExtraction';

const FILE = new File(['%PDF'], 'po.pdf', { type: 'application/pdf' });
const FUTURE = new Date(Date.now() + 15 * 60_000).toISOString();

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(svc.create).mockResolvedValue({ id: 'ex-1', uploadUrl: 'https://r2/put', expiresAt: FUTURE });
  vi.mocked(svc.upload).mockResolvedValue(undefined);
  vi.mocked(svc.start).mockResolvedValue({ status: 'queued' });
  vi.mocked(svc.discard).mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('useDocumentExtraction', () => {
  it('uploads, starts with the client sha, reads and reaches ready', async () => {
    vi.mocked(svc.get).mockResolvedValue({ id: 'ex-1', status: 'ready' } as DocumentExtraction);
    const { result } = renderHook(() => useDocumentExtraction(), { wrapper: wrapper() });
    await act(async () => { await result.current.start(FILE); });
    await waitFor(() => expect(result.current.state.stage).toBe('ready'));
    expect(svc.create).toHaveBeenCalledWith({ docType: 'sales_order', fileName: 'po.pdf', sizeBytes: FILE.size, contentType: 'application/pdf' });
    expect(svc.start).toHaveBeenCalledWith('ex-1', 'abc123');
  });

  it('surfaces a server failure with its message', async () => {
    vi.mocked(svc.get).mockResolvedValue({ id: 'ex-1', status: 'failed', failureCode: 'scanned', failureMessage: 'Scanned PDF.' } as DocumentExtraction);
    const { result } = renderHook(() => useDocumentExtraction(), { wrapper: wrapper() });
    await act(async () => { await result.current.start(FILE); });
    await waitFor(() => expect(result.current.state.stage).toBe('failed'));
    expect(result.current.state.failure).toEqual({ code: 'scanned', message: 'Scanned PDF.' });
  });

  it.each([
    ['daily_limit', 'limit'],
    ['ai_disabled', 'aiDisabled'],
    ['storage_full', 'storageFull'],
  ] as const)('maps create error %s to stage %s', async (code, stage) => {
    vi.mocked(svc.create).mockRejectedValue(new ExtractionApiError(429, 'nope', code));
    const { result } = renderHook(() => useDocumentExtraction(), { wrapper: wrapper() });
    await act(async () => { await result.current.start(FILE); });
    expect(result.current.state.stage).toBe(stage);
  });

  it('rejects an invalid file before any network call', async () => {
    const { result } = renderHook(() => useDocumentExtraction(), { wrapper: wrapper() });
    await act(async () => { await result.current.start(new File(['a'], 'x.csv', { type: 'text/csv' })); });
    expect(result.current.state.stage).toBe('failed');
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('auto-retries an interrupted upload with backoff and then succeeds', async () => {
    vi.mocked(svc.upload)
      .mockRejectedValueOnce(new UploadError('retryable', 'Network error during upload'))
      .mockResolvedValue(undefined);
    vi.mocked(svc.get).mockResolvedValue({ id: 'ex-1', status: 'running' } as DocumentExtraction);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useDocumentExtraction(), { wrapper: wrapper() });
    await act(async () => { await result.current.start(FILE); });
    await waitFor(() => expect(result.current.state.stage).toBe('interrupted'));
    expect(result.current.state.attempt).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    await waitFor(() => expect(result.current.state.stage).toBe('reading'));
    expect(svc.upload).toHaveBeenCalledTimes(2);
  });

  it('does not retry when storage rejects the PUT (R2 4xx)', async () => {
    vi.mocked(svc.upload).mockRejectedValue(new UploadError('storage_unavailable', 'Upload failed (403)', 403));
    const { result } = renderHook(() => useDocumentExtraction(), { wrapper: wrapper() });
    await act(async () => { await result.current.start(FILE); });
    await waitFor(() => expect(result.current.state.stage).toBe('failed'));
    expect(result.current.state.failure?.code).toBe('storage_unavailable');
    expect(svc.upload).toHaveBeenCalledTimes(1);
  });

  it('cancel aborts and discards the extraction', async () => {
    vi.mocked(svc.upload).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useDocumentExtraction(), { wrapper: wrapper() });
    await act(async () => { await result.current.start(FILE); });
    await waitFor(() => expect(result.current.state.stage).toBe('uploading'));
    act(() => result.current.cancel());
    expect(result.current.state.stage).toBe('cancelled');
    expect(svc.discard).toHaveBeenCalledWith('ex-1');
  });

  it('continueInBackground posts notify and reports failure as false', async () => {
    vi.mocked(svc.get).mockResolvedValue({ id: 'ex-1', status: 'running' } as DocumentExtraction);
    vi.mocked(svc.notify).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('x'));
    const { result } = renderHook(() => useDocumentExtraction(), { wrapper: wrapper() });
    await act(async () => { await result.current.start(FILE); });
    await waitFor(() => expect(result.current.state.stage).toBe('reading'));
    expect(await result.current.continueInBackground()).toBe(true);
    expect(svc.notify).toHaveBeenCalledWith('ex-1');
    expect(await result.current.continueInBackground()).toBe(false);
  });

  it.each([
    ['expired', 'expired'],
    [undefined, 'unknown'],
  ] as const)('a 404 while polling with code %s fails as %s', async (code, failureCode) => {
    vi.mocked(svc.get).mockRejectedValue(new ExtractionApiError(404, 'gone', code));
    const { result } = renderHook(() => useDocumentExtraction(), { wrapper: wrapper() });
    await act(async () => { await result.current.start(FILE); });
    // The poll query retries twice with backoff before surfacing the error.
    await waitFor(() => expect(result.current.state.stage).toBe('failed'), { timeout: 8000 });
    expect(result.current.state.failure?.code).toBe(failureCode);
    if (!code) expect(result.current.state.failure?.message).toMatch(/no longer available/);
  }, 10_000);
});
