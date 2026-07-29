import { describe, it, expect } from 'vitest'
import { withLines } from './inventoryDocumentLines'

interface WireLine { id: string }

// Mirrors a document envelope as it arrives: required header fields, and a
// `lines` key the server drops entirely once the slice is empty.
interface Wire {
  id: string
  number: string
  lineCount: number
  lines?: WireLine[] | null
}

/** Builds the fixture the way axios does — from the raw payload — so the
 *  "key is absent" cases are genuinely absent, not `lines: undefined`. */
function parseWire(json: string): Wire {
  return JSON.parse(json) as Wire
}

describe('withLines', () => {
  it('fills in an absent lines key with an empty array', () => {
    // A count is created DRFT with no lines — they are only built by the
    // freeze — and the API omits the key entirely for an empty slice
    // (`json:"lines,omitempty"`), so every fresh draft arrives without it.
    const wire = parseWire('{"id":"c-1","number":"ICNT-0001","lineCount":0}')
    expect('lines' in wire).toBe(false)
    expect(withLines(wire).lines).toEqual([])
  })

  it('treats an explicit null the same as an absent key', () => {
    const wire = parseWire('{"id":"c-1","number":"ICNT-0001","lineCount":0,"lines":null}')
    expect(withLines(wire).lines).toEqual([])
  })

  it('passes an existing lines array through untouched', () => {
    const lines: WireLine[] = [{ id: 'l-1' }]
    const wire: Wire = { id: 'c-1', number: 'ICNT-0001', lineCount: 1, lines }
    expect(withLines(wire).lines).toBe(lines)
  })

  it('keeps an empty array as an empty array', () => {
    const wire: Wire = { id: 'c-1', number: 'ICNT-0001', lineCount: 0, lines: [] }
    expect(withLines(wire).lines).toEqual([])
  })

  it('preserves every other field on the document', () => {
    const wire = parseWire('{"id":"c-1","number":"ICNT-0001","lineCount":0}')
    expect(withLines(wire)).toEqual({
      id: 'c-1', number: 'ICNT-0001', lineCount: 0, lines: [],
    })
  })
})
