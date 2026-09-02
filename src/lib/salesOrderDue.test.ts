import { describe, it, expect } from 'vitest'
import { formatDueLabel } from './salesOrderDue'

describe('formatDueLabel', () => {
  it('reads a positive daysLate as overdue, flagged for attention', () => {
    expect(formatDueLabel(12)).toEqual({ text: '12d late', warn: true })
  })

  it('reads daysLate = 1 as singular "1d late"', () => {
    expect(formatDueLabel(1)).toEqual({ text: '1d late', warn: true })
  })

  it('reads daysLate = 0 as due today, flagged for attention', () => {
    expect(formatDueLabel(0)).toEqual({ text: 'due today', warn: true })
  })

  it('reads a negative daysLate as a future due date, not flagged', () => {
    expect(formatDueLabel(-3)).toEqual({ text: 'due in 3d', warn: false })
  })

  it('reads daysLate = -1 as singular "due in 1d"', () => {
    expect(formatDueLabel(-1)).toEqual({ text: 'due in 1d', warn: false })
  })

  it('reads null as no expected delivery date set, not flagged', () => {
    expect(formatDueLabel(null)).toEqual({ text: 'no due date', warn: false })
  })
})
