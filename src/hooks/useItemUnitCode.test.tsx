import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/hooks/useInventoryLookups', () => ({ useInventoryLookups: vi.fn() }));

import { useItemUnitCode } from './useItemUnitCode';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';

const unit = (id: number, code: string) => ({ id, name: code, code, isActive: true, isSystem: true });

function withLookups(lookups: unknown) {
  vi.mocked(useInventoryLookups).mockReturnValue({
    lookups, isLoading: false, error: null,
  } as unknown as ReturnType<typeof useInventoryLookups>);
}

beforeEach(() => vi.clearAllMocks());

describe('useItemUnitCode', () => {
  it('resolves an item\'s unit id to its code, so a picked line can show its unit at once', () => {
    withLookups({ units: [unit(1, 'EA'), unit(6, 'SQFT')] });
    const { result } = renderHook(() => useItemUnitCode());

    expect(result.current({ unitId: 6 })).toBe('SQFT');
    expect(result.current({ unitId: 1 })).toBe('EA');
  });

  it('is blank for a unit it does not know', () => {
    withLookups({ units: [unit(1, 'EA')] });
    const { result } = renderHook(() => useItemUnitCode());
    expect(result.current({ unitId: 99 })).toBe('');
  });

  it('is blank while the lookups are still loading, rather than failing', () => {
    withLookups(undefined);
    const { result } = renderHook(() => useItemUnitCode());
    expect(result.current({ unitId: 6 })).toBe('');
  });

  it('keeps the same function while the units are unchanged', () => {
    const units = [unit(6, 'SQFT')];
    withLookups({ units });
    const { result, rerender } = renderHook(() => useItemUnitCode());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
