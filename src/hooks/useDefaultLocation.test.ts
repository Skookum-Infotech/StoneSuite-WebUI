import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDefaultLocation } from './useDefaultLocation';
import type { Warehouse } from '@/types/inventory';

const location = (over: Partial<Warehouse>): Warehouse => ({
  id: 'a', warehouseId: 1, name: 'Main', phone: '',
  address: { line1: '', line2: '', suite: '', city: '', country: '', state: '', zip: '' },
  isDefault: false, ...over,
});

const LOCATIONS = [
  location({ id: 'main', warehouseId: 1, isDefault: true }),
  location({ id: 'yard', warehouseId: 2, name: 'Yard' }),
];

describe('useDefaultLocation', () => {
  it("starts on the tenant's default location", () => {
    const { result } = renderHook(() => useDefaultLocation(LOCATIONS));

    expect(result.current[0]).toBe('main');
  });

  it('is empty while the lookups have not loaded, and fills in once they do', () => {
    const { result, rerender } = renderHook(({ list }) => useDefaultLocation(list), {
      initialProps: { list: [] as Warehouse[] },
    });
    expect(result.current[0]).toBe('');

    rerender({ list: LOCATIONS });

    expect(result.current[0]).toBe('main');
  });

  it('lets the user choose another location', () => {
    const { result } = renderHook(() => useDefaultLocation(LOCATIONS));

    act(() => result.current[1]('yard'));

    expect(result.current[0]).toBe('yard');
  });

  it('keeps the user\'s choice when the lookups refetch', () => {
    const { result, rerender } = renderHook(({ list }) => useDefaultLocation(list), {
      initialProps: { list: LOCATIONS },
    });
    act(() => result.current[1]('yard'));

    rerender({ list: [...LOCATIONS] });

    expect(result.current[0]).toBe('yard');
  });

  it('is empty when the tenant has locations but none is the default', () => {
    const { result } = renderHook(() => useDefaultLocation([location({ isDefault: false })]));

    expect(result.current[0]).toBe('');
  });
});
