import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyUploadStatus, attachmentService, UploadError } from './attachmentService';
import { sha256Hex } from './documentExtractionService';

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
