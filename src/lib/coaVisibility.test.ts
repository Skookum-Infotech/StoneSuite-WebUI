import { describe, it, expect } from 'vitest'
import { visibilityPayload, applicableVisibilityActions } from './coaVisibility'

describe('visibilityPayload', () => {
  it('activate sends only isActive:true', () => {
    expect(visibilityPayload('activate')).toEqual({ isActive: true })
  })
  it('deactivate sends only isActive:false', () => {
    expect(visibilityPayload('deactivate')).toEqual({ isActive: false })
  })
  it('show sends only isVisible:true', () => {
    expect(visibilityPayload('show')).toEqual({ isVisible: true })
  })
  it('hide always bundles isActive:false — never isVisible:false alone', () => {
    expect(visibilityPayload('hide')).toEqual({ isActive: false, isVisible: false })
  })
})

describe('applicableVisibilityActions', () => {
  it('active+visible offers deactivate and hide', () => {
    expect(applicableVisibilityActions({ isActive: true, isVisible: true })).toEqual(['deactivate', 'hide'])
  })
  it('inactive+visible offers activate and hide', () => {
    expect(applicableVisibilityActions({ isActive: false, isVisible: true })).toEqual(['activate', 'hide'])
  })
  it('inactive+hidden offers activate and show', () => {
    expect(applicableVisibilityActions({ isActive: false, isVisible: false })).toEqual(['activate', 'show'])
  })

  it('never returns an action whose payload could produce active+hidden', () => {
    // Mirrors store_update.go's AD-8 implicit-unhide: activating a hidden
    // account with isVisible omitted un-hides it server-side.
    function applyPayload(
      state: { isActive: boolean; isVisible: boolean },
      payload: ReturnType<typeof visibilityPayload>,
    ) {
      const nextActive = payload.isActive ?? state.isActive
      let nextVisible = payload.isVisible ?? state.isVisible
      if (payload.isActive === true && payload.isVisible === undefined && !state.isVisible) {
        nextVisible = true
      }
      return { isActive: nextActive, isVisible: nextVisible }
    }

    const allStates = [
      { isActive: true, isVisible: true },
      { isActive: false, isVisible: true },
      { isActive: false, isVisible: false },
    ]
    for (const state of allStates) {
      for (const action of applicableVisibilityActions(state)) {
        const next = applyPayload(state, visibilityPayload(action))
        expect(next.isActive && !next.isVisible).toBe(false)
      }
    }
  })
})
