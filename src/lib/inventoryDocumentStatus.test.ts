import { describe, it, expect } from 'vitest'
import {
  docStatusLabel, docTransitionLabel, APPROVAL_TARGET_STATUS, DOC_STATUS_COLORS,
} from './inventoryDocumentStatus'

describe('docStatusLabel', () => {
  it.each([
    ['DRFT', 'Draft'],
    ['PAPV', 'Pending Approval'],
    ['APPV', 'Approved'],
    ['POST', 'Posted'],
    ['CANC', 'Cancelled'],
    ['TRNS', 'In Transit'],
    ['RCVD', 'Received'],
    ['CNTG', 'Counting'],
    ['RVW_', 'In Review'],
  ])('label(%p) -> %p', (code, expected) => {
    expect(docStatusLabel(code)).toBe(expected)
  })

  it('falls back to the raw code for an unrecognized status', () => {
    expect(docStatusLabel('ZZZZ')).toBe('ZZZZ')
  })
})

describe('docTransitionLabel', () => {
  it('distinguishes the same target status reached from different sources', () => {
    expect(docTransitionLabel('PAPV', 'DRFT')).toBe('Reject to Draft')
    expect(docTransitionLabel('APPV', 'DRFT')).toBe('Revise')
  })

  it('labels the count review edge', () => {
    expect(docTransitionLabel('CNTG', 'RVW_')).toBe('Send to Review')
    expect(docTransitionLabel('RVW_', 'APPV')).toBe('Approve')
  })

  it('labels the transfer-specific ship/receive legs', () => {
    expect(docTransitionLabel('APPV', 'TRNS')).toBe('Ship')
    expect(docTransitionLabel('TRNS', 'RCVD')).toBe('Receive')
  })

  it('labels the count-specific freeze and recount edges', () => {
    expect(docTransitionLabel('DRFT', 'CNTG')).toBe('Freeze & Start Counting')
    expect(docTransitionLabel('RVW_', 'CNTG')).toBe('Recount')
  })

  it('falls back to "Move to <label>" for an unmapped pair', () => {
    expect(docTransitionLabel('DRFT', 'ZZZZ')).toBe('Move to ZZZZ')
  })
})

describe('APPROVAL_TARGET_STATUS', () => {
  it('is APPV — the one status every module gates behind the approve grant', () => {
    expect(APPROVAL_TARGET_STATUS).toBe('APPV')
  })
})

describe('DOC_STATUS_COLORS', () => {
  it('has a color for every status docStatusLabel recognizes', () => {
    for (const code of ['DRFT', 'PAPV', 'APPV', 'POST', 'CANC', 'TRNS', 'RCVD', 'CNTG', 'RVW_']) {
      expect(DOC_STATUS_COLORS[code]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
