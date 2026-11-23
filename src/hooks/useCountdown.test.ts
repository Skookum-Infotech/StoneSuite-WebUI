import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCountdown } from './useCountdown'

afterEach(() => {
  vi.useRealTimers()
})

// Each second is its own act(): the next tick is only scheduled once React has
// re-rendered from the last one, exactly as real time delivers them. One big
// advanceTimersByTime inside a single act would fire the first tick and stop.
function waitSeconds(seconds: number) {
  for (let i = 0; i < seconds; i++) {
    act(() => vi.advanceTimersByTime(1000))
  }
}

describe('useCountdown', () => {
  it('counts down one second at a time and stops at zero', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCountdown(3))
    expect(result.current.secondsLeft).toBe(3)

    waitSeconds(1)
    expect(result.current.secondsLeft).toBe(2)

    waitSeconds(5)
    expect(result.current.secondsLeft).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('starts at zero and sets no timer when there is nothing to wait for', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCountdown(0))
    expect(result.current.secondsLeft).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('restart sets a new length, and 0 ends it at once', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCountdown(1))

    act(() => result.current.restart(30))
    expect(result.current.secondsLeft).toBe(30)

    waitSeconds(2)
    expect(result.current.secondsLeft).toBe(28)

    act(() => result.current.restart(0))
    expect(result.current.secondsLeft).toBe(0)
  })

  it('never goes negative', () => {
    const { result } = renderHook(() => useCountdown(-5))
    expect(result.current.secondsLeft).toBe(0)
    act(() => result.current.restart(-1))
    expect(result.current.secondsLeft).toBe(0)
  })

  it('clears its timer on unmount', () => {
    vi.useFakeTimers()
    const { unmount } = renderHook(() => useCountdown(10))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
