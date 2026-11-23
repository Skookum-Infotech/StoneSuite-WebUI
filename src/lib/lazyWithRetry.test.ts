// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lazyWithRetry } from './lazyWithRetry';

const CHUNK_RELOAD_KEY = 'chunk_reload_attempted';

type LazyInternals = { _payload: { _result: () => Promise<unknown> } };
function runFactory(component: unknown): Promise<unknown> {
  return (component as LazyInternals)._payload._result();
}

describe('lazyWithRetry', () => {
  beforeEach(() => sessionStorage.clear());

  it('re-arms the one-time reload after a chunk loads successfully', async () => {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    const lazyComponent = lazyWithRetry<object>(() => Promise.resolve({ default: () => null }));

    await runFactory(lazyComponent);

    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull();
  });

  it('rejects instead of reloading when a reload was already attempted', async () => {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    const lazyComponent = lazyWithRetry<object>(() => Promise.reject(new Error('chunk 404')));

    await expect(runFactory(lazyComponent)).rejects.toThrow('chunk 404');
    expect(reload).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
