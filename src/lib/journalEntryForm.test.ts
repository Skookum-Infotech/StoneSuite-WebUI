import { describe, it, expect } from 'vitest'
import {
  toCreatePayload, toUpdatePayload, fromJournalEntry, journalEntryDefaults, jeStatusLabel,
  JE_EDITABLE_STATUSES, JE_APPROVABLE_STATUSES, JE_POSTABLE_STATUSES,
  JE_REVERSIBLE_STATUSES, JE_CANCELLABLE_STATUSES, JE_DELETABLE_STATUSES,
} from './journalEntryForm'
import type { JournalEntry } from '@/types/journalEntry'

describe('toCreatePayload', () => {
  const baseData: Record<string, unknown> = {
    amount: 1500.5,
    transfer_date: '2026-07-15',
    reference: 'Check #1042',
    owner_employee: '3',
    notes: 'note',
    internal_notes: 'internal only',
  }

  it('maps form fields + accounts to the create payload', () => {
    const payload = toCreatePayload('from-uuid', 'to-uuid', baseData)
    expect(payload).toEqual({
      fromAccountUuid: 'from-uuid',
      toAccountUuid: 'to-uuid',
      amount: 1500.5,
      transferDate: '2026-07-15',
      reference: 'Check #1042',
      notes: 'note',
      internalNotes: 'internal only',
      ownerEmployeeId: 3,
      customFields: {},
    })
  })

  it('defaults an unset owner to null', () => {
    const payload = toCreatePayload('from-uuid', 'to-uuid', { ...baseData, owner_employee: '' })
    expect(payload.ownerEmployeeId).toBeNull()
  })

  it('coerces a non-numeric amount to 0', () => {
    const payload = toCreatePayload('from-uuid', 'to-uuid', { ...baseData, amount: 'not-a-number' })
    expect(payload.amount).toBe(0)
  })

  it('passes custom fields through unchanged', () => {
    const payload = toCreatePayload('from-uuid', 'to-uuid', baseData, { cf_project: 'Acme' })
    expect(payload.customFields).toEqual({ cf_project: 'Acme' })
  })
})

describe('toUpdatePayload', () => {
  it('includes recordVersion alongside the header fields', () => {
    const payload = toUpdatePayload('from-uuid', 'to-uuid', {
      amount: 250, transfer_date: '2026-08-01', reference: 'REF-2',
      owner_employee: '', notes: '', internal_notes: '',
    }, {}, 4)
    expect(payload).toEqual({
      fromAccountUuid: 'from-uuid',
      toAccountUuid: 'to-uuid',
      amount: 250,
      transferDate: '2026-08-01',
      reference: 'REF-2',
      // Blank notes fields are omitted (undefined), not sent as "" — mirrors
      // itemReceiptForm.ts's toHeaderFields convention.
      notes: undefined,
      internalNotes: undefined,
      ownerEmployeeId: null,
      customFields: {},
      recordVersion: 4,
    })
  })

  it('defaults recordVersion to 0 when omitted (opts out of the concurrency check)', () => {
    const payload = toUpdatePayload('from-uuid', 'to-uuid', { amount: 10 })
    expect(payload.recordVersion).toBe(0)
  })
})

describe('fromJournalEntry', () => {
  const je: JournalEntry = {
    id: 'je-1',
    number: 'JE-000001',
    status: 'Draft',
    statusCode: 'DRFT',
    transferDate: '2026-07-15T00:00:00Z',
    fromAccount: { id: 'acct-1', code: '1010', name: 'Operating Bank' },
    toAccount: { id: 'acct-2', code: '1020', name: 'Petty Cash' },
    amount: 500,
    reference: 'REF-9',
    notes: 'Notes text',
    internalNotes: 'Internal text',
    ownerEmployeeId: 7,
    customFields: { cf_project: 'Acme' },
    createdAt: '2026-07-15T00:00:00Z',
    updatedAt: '2026-07-15T00:00:00Z',
    recordVersion: 2,
  }

  it('maps a loaded journal entry back to editable form state', () => {
    const { data, customFieldValues, fromAccount, toAccount } = fromJournalEntry(je)
    expect(data).toEqual({
      je_status: 'Draft',
      je_doc_num: 'JE-000001',
      amount: 500,
      transfer_date: '2026-07-15',
      reference: 'REF-9',
      owner_employee: '7',
      notes: 'Notes text',
      internal_notes: 'Internal text',
    })
    expect(customFieldValues).toEqual({ cf_project: 'Acme' })
    expect(fromAccount).toEqual({ id: 'acct-1', code: '1010', name: 'Operating Bank' })
    expect(toAccount).toEqual({ id: 'acct-2', code: '1020', name: 'Petty Cash' })
  })

  it('renders a null ownerEmployeeId as an empty string, not "null"', () => {
    const { data } = fromJournalEntry({ ...je, ownerEmployeeId: null })
    expect(data.owner_employee).toBe('')
  })
})

describe('journalEntryDefaults', () => {
  it('defaults transfer_date to today (ISO date only)', () => {
    const today = new Date().toISOString().split('T')[0]
    expect(journalEntryDefaults()).toEqual({ transfer_date: today })
  })
})

describe('jeStatusLabel', () => {
  it.each([
    ['DRFT', 'Draft'],
    ['APPR', 'Approved'],
    ['POST', 'Posted'],
    ['CANC', 'Cancelled'],
    ['RVSD', 'Reversed'],
  ])('jeStatusLabel(%p) -> %p', (code, expected) => {
    expect(jeStatusLabel(code)).toBe(expected)
  })

  it('falls back to the raw code for an unknown status', () => {
    expect(jeStatusLabel('XYZZY')).toBe('XYZZY')
  })
})

// Mirrors cashtransfer/transitions.go's allowedTransitions map (spec AD-5/AD-6):
// DRFT -> APPR/CANC, APPR -> POST/CANC, POST -> RVSD, CANC/RVSD terminal.
describe('status-gated action sets', () => {
  it('editing is Draft-only', () => {
    expect([...JE_EDITABLE_STATUSES]).toEqual(['DRFT'])
  })

  it('approve is legal from Draft only', () => {
    expect([...JE_APPROVABLE_STATUSES]).toEqual(['DRFT'])
  })

  it('post is Approved-only', () => {
    expect([...JE_POSTABLE_STATUSES]).toEqual(['APPR'])
  })

  it('reverse is Posted-only', () => {
    expect([...JE_REVERSIBLE_STATUSES]).toEqual(['POST'])
  })

  it('cancel is legal from Draft or Approved', () => {
    expect(JE_CANCELLABLE_STATUSES.has('DRFT')).toBe(true)
    expect(JE_CANCELLABLE_STATUSES.has('APPR')).toBe(true)
    expect(JE_CANCELLABLE_STATUSES.has('POST')).toBe(false)
    expect(JE_CANCELLABLE_STATUSES.has('RVSD')).toBe(false)
  })

  it('delete is Draft-only', () => {
    expect([...JE_DELETABLE_STATUSES]).toEqual(['DRFT'])
  })
})
