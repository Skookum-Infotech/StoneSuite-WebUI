import { describe, it, expect } from 'vitest'
import { copiedName, copyPath, copySubtitle, isCopySourceId, resetCopiedFields } from './recordCopy'

describe('isCopySourceId', () => {
  it.each([
    ['0b7c1e52-1f6a-4c1d-9a55-3f1b2c9d8e10', true],
    ['so_1-A', true],
    ['', false],
    ['../quotes', false],
    ['a/b', false],
    ['a?b=1', false],
    ['a b', false],
  ])('%j -> %s', (id, expected) => {
    expect(isCopySourceId(id)).toBe(expected)
  })
})

describe('copySubtitle', () => {
  it('names the source and says nothing exists yet', () => {
    expect(copySubtitle('SO-0007')).toBe('Copied from SO-0007. Nothing is created until you save.')
  })
})

describe('copyPath', () => {
  it.each([
    ['/sales/sales_order/new', 'abc-123', '/sales/sales_order/new?copyFrom=abc-123'],
    ['/inventory/item/new', 'a b/c', '/inventory/item/new?copyFrom=a%20b%2Fc'],
  ])('%s + %s', (addPath, id, expected) => {
    expect(copyPath(addPath, id)).toBe(expected)
  })
})

describe('resetCopiedFields', () => {
  it('restores the Add-form default, or blank when the default leaves it unset', () => {
    const data = { date: '2025-01-01', po: 'PO-9', keep: 'x' }
    expect(resetCopiedFields(data, { date: '2026-10-21' }, ['date', 'po'])).toEqual({
      date: '2026-10-21', po: '', keep: 'x',
    })
  })

  it('does not mutate the source data', () => {
    const data = { po: 'PO-9' }
    resetCopiedFields(data, {}, ['po'])
    expect(data.po).toBe('PO-9')
  })

  it('keeps a falsy default (false) rather than blanking it', () => {
    expect(resetCopiedFields({ is_active: false }, { is_active: true }, ['is_active'])).toEqual({ is_active: true })
  })
})

describe('copiedName', () => {
  it.each([
    ['Calacatta Slab', 'Calacatta Slab (Copy)'],
    ['  Calacatta Slab  ', 'Calacatta Slab (Copy)'],
    ['Calacatta Slab (Copy)', 'Calacatta Slab (Copy)'],
    ['', ''],
  ])('%j -> %j', (name, expected) => {
    expect(copiedName(name)).toBe(expected)
  })
})
