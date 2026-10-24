import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyUploadStatus, attachmentService, UploadError } from './attachmentService';
import { AxiosError } from 'axios';
import { tenantClient } from '@/api/tenantClient';
import { documentExtractionService, sha256Hex } from './documentExtractionService';

describe('sha256Hex', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ])('hashes %j to lowercase hex', async (text, hex) => {
    const blob = new Blob([text]);
    if (!blob.arrayBuffer) Object.defineProperty(blob, 'arrayBuffer', { value: () => new Response(blob).arrayBuffer() });
    expect(await sha256Hex(blob)).toBe(hex);
  });
});

describe('classifyUploadStatus', () => {
  it.each([
    [400, 'storage_unavailable'], [403, 'storage_unavailable'], [404, 'storage_unavailable'],
    [500, 'retryable'], [503, 'retryable'], [0, 'retryable'],
  ] as const)('%i -> %s', (status, kind) => {
    expect(classifyUploadStatus(status)).toBe(kind);
  });
});

class FakeXHR {
  static last: FakeXHR;
  status = 0;
  upload: { onprogress?: (e: unknown) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  onabort?: () => void;
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  abort = vi.fn(() => this.onabort?.());
  constructor() { FakeXHR.last = this; }
}

describe('attachmentService.uploadToR2 error classification', () => {
  const file = new File(['x'], 'po.pdf', { type: 'application/pdf' });
  beforeEach(() => { vi.stubGlobal('XMLHttpRequest', FakeXHR); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('resolves on 2xx', async () => {
    const p = attachmentService.uploadToR2('https://r2/x', file);
    FakeXHR.last.status = 200;
    FakeXHR.last.onload?.();
    await expect(p).resolves.toBeUndefined();
  });

  it.each([[403, 'storage_unavailable'], [503, 'retryable']] as const)('status %i rejects as %s', async (status, kind) => {
    const p = attachmentService.uploadToR2('https://r2/x', file);
    FakeXHR.last.status = status;
    FakeXHR.last.onload?.();
    await expect(p).rejects.toMatchObject({ kind, status });
  });

  it('network error is retryable', async () => {
    const p = attachmentService.uploadToR2('https://r2/x', file);
    FakeXHR.last.onerror?.();
    await expect(p).rejects.toMatchObject({ kind: 'retryable' });
  });

  it('abort signal aborts the XHR and rejects as aborted', async () => {
    const ctrl = new AbortController();
    const p = attachmentService.uploadToR2('https://r2/x', file, undefined, ctrl.signal);
    ctrl.abort();
    await expect(p).rejects.toBeInstanceOf(UploadError);
    await expect(p).rejects.toMatchObject({ kind: 'aborted' });
    expect(FakeXHR.last.abort).toHaveBeenCalled();
  });

  it('rejects immediately when already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(attachmentService.uploadToR2('https://r2/x', file, undefined, ctrl.signal)).rejects.toMatchObject({ kind: 'aborted' });
  });
});

describe('documentExtractionService.proposeEntity', () => {
  afterEach(() => vi.restoreAllMocks());

  it('POSTs overrides to the encoded propose path and returns the action', async () => {
    const action = { id: 'pa-1', status: 'pending' };
    const post = vi.spyOn(tenantClient, 'post').mockResolvedValue({ data: { success: true, action } });
    const res = await documentExtractionService.proposeEntity('ext 1', 'vendor:acme/co', { contactEmail: 'a@b.co' });
    expect(res).toBe(action);
    expect(post).toHaveBeenCalledWith(
      '/tenant/document-extractions/ext%201/proposed-entities/vendor%3Aacme%2Fco/propose',
      { overrides: { contactEmail: 'a@b.co' } },
    );
  });

  it('sends an empty body when there are no overrides', async () => {
    const post = vi.spyOn(tenantClient, 'post').mockResolvedValue({ data: { success: true, action: {} } });
    await documentExtractionService.proposeEntity('e', 'k');
    expect(post).toHaveBeenCalledWith('/tenant/document-extractions/e/proposed-entities/k/propose', {});
  });

  it.each([403, 404, 409, 422])('maps a %i to an ExtractionApiError with the server message', async (status) => {
    const err = new AxiosError('Request failed');
    err.response = { status, data: { success: false, message: `msg ${status}` } } as never;
    vi.spyOn(tenantClient, 'post').mockRejectedValue(err);
    await expect(documentExtractionService.proposeEntity('e', 'k')).rejects.toMatchObject({
      name: 'ExtractionApiError', status, message: `msg ${status}`,
    });
  });
});
