// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DXF_PARSE_TIMEOUT_MS, parseDxfScene } from './dxfParseClient';
import { DxfTooComplexError, DxfUnreadableError, type DxfScene } from './dxfSceneTypes';

const scene: DxfScene = { paths: [], texts: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, unsupported: {} };

class FakeWorker {
  static last: FakeWorker;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    FakeWorker.last = this;
  }
  reply(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

beforeEach(() => {
  vi.stubGlobal('Worker', FakeWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('parseDxfScene', () => {
  it('sends the bytes to a worker and resolves with its scene', async () => {
    const bytes = new ArrayBuffer(8);
    const result = parseDxfScene(bytes);
    FakeWorker.last.reply({ ok: true, scene });
    await expect(result).resolves.toEqual(scene);
    expect(FakeWorker.last.postMessage).toHaveBeenCalledWith(bytes, [bytes]);
  });

  it('frees the worker once it answers', async () => {
    const result = parseDxfScene(new ArrayBuffer(8));
    FakeWorker.last.reply({ ok: true, scene });
    await result;
    expect(FakeWorker.last.terminate).toHaveBeenCalled();
  });

  it.each([
    ['unreadable', DxfUnreadableError],
    ['too_complex', DxfTooComplexError],
  ])('rebuilds a %s failure as its own error type', async (kind, errorClass) => {
    const result = parseDxfScene(new ArrayBuffer(8));
    FakeWorker.last.reply({ ok: false, kind, message: 'nope' });
    await expect(result).rejects.toBeInstanceOf(errorClass);
  });

  it('treats a crashed worker as an unreadable file', async () => {
    const result = parseDxfScene(new ArrayBuffer(8));
    FakeWorker.last.onerror?.({} as ErrorEvent);
    await expect(result).rejects.toBeInstanceOf(DxfUnreadableError);
    expect(FakeWorker.last.terminate).toHaveBeenCalled();
  });

  // dxf-parser loops forever on a POLYLINE with no SEQEND, so a malformed file
  // must not be able to pin a worker (or anyone opening that order) for good.
  it('gives up on a parse that never finishes', async () => {
    vi.useFakeTimers();
    const result = parseDxfScene(new ArrayBuffer(8));
    const expectation = expect(result).rejects.toBeInstanceOf(DxfUnreadableError);
    await vi.advanceTimersByTimeAsync(DXF_PARSE_TIMEOUT_MS);
    await expectation;
    expect(FakeWorker.last.terminate).toHaveBeenCalled();
  });

  it('stops when the caller no longer needs the result', async () => {
    const controller = new AbortController();
    const result = parseDxfScene(new ArrayBuffer(8), controller.signal);
    controller.abort();
    await expect(result).rejects.toThrow();
    expect(FakeWorker.last.terminate).toHaveBeenCalled();
  });
});
