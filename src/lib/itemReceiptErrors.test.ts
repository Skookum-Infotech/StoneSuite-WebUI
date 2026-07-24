import { describe, it, expect } from 'vitest'
import { AxiosError } from 'axios'
import { isOverReceiptMessage, parseOverReceiptLines, overReceiptDetails } from './itemReceiptErrors'

const SAMPLE_MESSAGE =
  'delivery exceeds the ordered quantity beyond the accepted tolerance: ' +
  'line 7 (ordered 10, already received 0, receiving 50); ' +
  'line 3 (ordered 5, already received 2, receiving 8)'

describe('isOverReceiptMessage', () => {
  it('matches the ErrOverReceipt sentence', () => {
    expect(isOverReceiptMessage(SAMPLE_MESSAGE)).toBe(true)
  })
  it('does not match an unrelated 403 message', () => {
    expect(isOverReceiptMessage('You do not have permission to transition item receipts.')).toBe(false)
  })
})

describe('parseOverReceiptLines', () => {
  it('extracts every offending line with its ordered/already-received/receiving quantities', () => {
    expect(parseOverReceiptLines(SAMPLE_MESSAGE)).toEqual([
      { lineNumber: 7, ordered: 10, alreadyReceived: 0, receiving: 50 },
      { lineNumber: 3, ordered: 5, alreadyReceived: 2, receiving: 8 },
    ])
  })

  it('handles a single offending line', () => {
    const msg = 'delivery exceeds the ordered quantity beyond the accepted tolerance: line 1 (ordered 100, already received 40, receiving 65)'
    expect(parseOverReceiptLines(msg)).toEqual([
      { lineNumber: 1, ordered: 100, alreadyReceived: 40, receiving: 65 },
    ])
  })

  it('returns an empty array when the message has no line detail', () => {
    expect(parseOverReceiptLines('some other error')).toEqual([])
  })
})

describe('overReceiptDetails', () => {
  function make403(message: string) {
    return new AxiosError('Request failed', '403', undefined, undefined, {
      status: 403,
      data: { message },
    } as never)
  }

  it('returns parsed lines for a 403 over-receipt error', () => {
    const details = overReceiptDetails(make403(SAMPLE_MESSAGE))
    expect(details?.lines).toHaveLength(2)
    expect(details?.message).toBe(SAMPLE_MESSAGE)
  })

  it('returns null for a 403 that is not an over-receipt denial', () => {
    expect(overReceiptDetails(make403('You do not have permission to transition item receipts.'))).toBeNull()
  })

  it('returns null for a non-403 error', () => {
    const err = new AxiosError('Request failed', '404', undefined, undefined, {
      status: 404,
      data: { message: SAMPLE_MESSAGE },
    } as never)
    expect(overReceiptDetails(err)).toBeNull()
  })

  it('returns null for a non-axios error', () => {
    expect(overReceiptDetails(new Error('boom'))).toBeNull()
  })
})
