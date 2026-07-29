import { describe, it, expect } from 'vitest'
import { withLines } from './inventoryDocumentLines'

describe('withLines', () => {
  it('fills in an absent lines key with an empty array', () => {
    // A count is created DRFT with no lines — they are only built by the
    // freeze — and the API omits the key entirely for an empty slice
    // (`json:"lines,omitempty"`), so every fresh draft arrives without it.
    const wire = { id: 'c-1', number: 'ICNT-0001', lineCount: 0 }
    expect(withLines(wire).lines).toEqual([])
  })

  it('treats an explicit null the same as an absent key', () => {
    expect(withLines({ id: 'c-1', lines: null }).lines).toEqual([])
  })

  it('passes an existing lines array through untouched', () => {
    const lines = [{ id: 'l-1' }]
    expect(withLines({ id: 'c-1', lines }).lines).toBe(lines)
  })

  it('keeps an empty array as an empty array', () => {
    expect(withLines({ id: 'c-1', lines: [] }).lines).toEqual([])
  })

  it('preserves every other field on the document', () => {
    expect(withLines({ id: 'c-1', number: 'ICNT-0001', lineCount: 0 })).toEqual({
      id: 'c-1', number: 'ICNT-0001', lineCount: 0, lines: [],
    })
  })
})
