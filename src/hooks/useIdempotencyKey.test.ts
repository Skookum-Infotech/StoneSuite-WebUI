import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIdempotencyKey } from './useIdempotencyKey';

describe('useIdempotencyKey', () => {
  it('reuses the key while the request is unchanged, so a retry is recognised by the server', () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const first = result.current.keyFor('payload-a');
    expect(first).toBeTruthy();
    expect(result.current.keyFor('payload-a')).toBe(first);
  });

  it('issues a fresh key when the request changes', () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const first = result.current.keyFor('payload-a');
    expect(result.current.keyFor('payload-b')).not.toBe(first);
  });

  it('starts a new key after reset, so a later identical request is not a replay', () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const first = result.current.keyFor('payload-a');
    result.current.reset();
    expect(result.current.keyFor('payload-a')).not.toBe(first);
  });

  it('keeps a stable keyFor/reset identity across renders', () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey());
    const { keyFor, reset } = result.current;
    rerender();
    expect(result.current.keyFor).toBe(keyFor);
    expect(result.current.reset).toBe(reset);
  });
});
