import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useIdSelection } from './useIdSelection'

describe('useIdSelection', () => {
  it('starts empty and toggles ids on and off', () => {
    const ids = ['a', 'b', 'c']
    const { result } = renderHook(() => useIdSelection(ids))
    expect(result.current.selected.size).toBe(0)

    act(() => result.current.toggle('a'))
    act(() => result.current.toggle('b'))
    expect([...result.current.selected]).toEqual(['a', 'b'])

    act(() => result.current.toggle('a'))
    expect([...result.current.selected]).toEqual(['b'])
  })

  it('selects a whole list at once and clears it', () => {
    const ids = ['a', 'b', 'c']
    const { result } = renderHook(() => useIdSelection(ids))

    act(() => result.current.setAll(ids))
    expect(result.current.selected.size).toBe(3)

    act(() => result.current.clear())
    expect(result.current.selected.size).toBe(0)
  })

  it('drops an id that is no longer in the list', () => {
    const { result, rerender } = renderHook(({ ids }) => useIdSelection(ids), {
      initialProps: { ids: ['a', 'b'] },
    })
    act(() => result.current.setAll(['a', 'b']))

    rerender({ ids: ['b'] })

    expect([...result.current.selected]).toEqual(['b'])
  })
})
