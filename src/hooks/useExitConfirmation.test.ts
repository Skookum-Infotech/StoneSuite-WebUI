import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExitConfirmation } from './useExitConfirmation'

const EXIT_GUARD_KEY = 'stonesuiteExitGuard'

function currentState(): Record<string, unknown> | null {
  return window.history.state as Record<string, unknown> | null
}

/** Put the tab at a given React Router stack position, as its history would. */
function seedStack(idx: number, extra: Record<string, unknown> = {}) {
  window.history.replaceState({ usr: null, key: 'k', idx, ...extra }, '', '/dashboard')
}

// jsdom never fires popstate on its own, so the Back press is simulated: move the
// stack to where the browser would have landed, then dispatch the event it sends.
function pressBackTo(idx: number, extra: Record<string, unknown> = {}) {
  act(() => {
    window.history.replaceState({ usr: null, key: 'k', idx, ...extra }, '', '/dashboard')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
}

describe('useExitConfirmation', () => {
  beforeEach(() => {
    seedStack(0)
  })

  it('parks a guard entry when sitting at the bottom of the stack', () => {
    renderHook(() => useExitConfirmation(true))
    expect(currentState()?.[EXIT_GUARD_KEY]).toBe(true)
  })

  it('does not park anything when there is still app history to go back through', () => {
    seedStack(3)
    renderHook(() => useExitConfirmation(true))
    expect(currentState()?.[EXIT_GUARD_KEY]).toBeUndefined()
  })

  it('leaves history untouched when disabled', () => {
    renderHook(() => useExitConfirmation(false))
    expect(currentState()?.[EXIT_GUARD_KEY]).toBeUndefined()
  })

  it('prompts when the Back press consumes the parked entry', () => {
    const { result } = renderHook(() => useExitConfirmation(true))
    expect(result.current.isPrompting).toBe(false)

    pressBackTo(0)

    expect(result.current.isPrompting).toBe(true)
  })

  it('stays silent for an ordinary Back press deeper in the app', () => {
    seedStack(3)
    const { result } = renderHook(() => useExitConfirmation(true))

    pressBackTo(2)

    expect(result.current.isPrompting).toBe(false)
  })

  it('stays silent when the pop merely lands on the parked entry itself', () => {
    const { result } = renderHook(() => useExitConfirmation(true))

    pressBackTo(0, { [EXIT_GUARD_KEY]: true })

    expect(result.current.isPrompting).toBe(false)
  })

  it('re-parks after a prompt so a second Back press is also caught', () => {
    const { result } = renderHook(() => useExitConfirmation(true))

    pressBackTo(0)
    act(() => result.current.dismiss())
    expect(result.current.isPrompting).toBe(false)
    expect(currentState()?.[EXIT_GUARD_KEY]).toBe(true)

    pressBackTo(0)
    expect(result.current.isPrompting).toBe(true)
  })

  it('arms late: a stack that bottoms out only after backing through the app', () => {
    seedStack(2)
    const { result } = renderHook(() => useExitConfirmation(true))
    expect(currentState()?.[EXIT_GUARD_KEY]).toBeUndefined()

    pressBackTo(1)
    expect(result.current.isPrompting).toBe(false)

    pressBackTo(0)
    expect(result.current.isPrompting).toBe(true)
    expect(currentState()?.[EXIT_GUARD_KEY]).toBe(true)
  })

  it('ignores Back presses once disabled', () => {
    const { result, rerender } = renderHook(({ on }) => useExitConfirmation(on), {
      initialProps: { on: true },
    })

    rerender({ on: false })
    pressBackTo(0)

    expect(result.current.isPrompting).toBe(false)
  })
})
