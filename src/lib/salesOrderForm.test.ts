import { describe, it, expect } from 'vitest'
import { clampPercent, SO_CONVERTIBLE_STATUSES } from './salesOrderForm'

// clampPercent guards discount/tax % inputs on the Sales Order items table —
// see SalesOrderItemsTab's updateDraft, which applies it on every keystroke
// since rows commit via a button click rather than a native form submit.
describe('clampPercent', () => {
  it.each([
    ['', ''],
    ['50', '50'],
    ['0', '0'],
    ['100', '100'],
    ['-5', '0'],
    ['150', '100'],
    ['-0.5', '0'],
    ['100.5', '100'],
  ])('clampPercent(%p) -> %p', (input, expected) => {
    expect(clampPercent(input)).toBe(expected)
  })

  it('leaves a non-numeric in-progress value untouched', () => {
    expect(clampPercent('-')).toBe('-')
  })
})

describe('SO_CONVERTIBLE_STATUSES', () => {
  it.each([
    ['DRFT', false],
    ['PAPV', false],
    ['APPV', true],
    ['OPEN', true],
    ['PART', true],
    ['FILL', true],
    ['CANC', false],
  ])('has(%p) -> %p', (code, expected) => {
    expect(SO_CONVERTIBLE_STATUSES.has(code)).toBe(expected)
  })
})
