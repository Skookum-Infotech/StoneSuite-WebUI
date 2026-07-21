import { describe, it, expect } from 'vitest'
import {
  buildAuditParams,
  hasActiveFilters,
  detailsEmployeeId,
  actorLabel,
  isRawActorId,
  dayStartRfc3339,
  dayEndRfc3339,
  formatDetails,
  humanizeToken,
  resourceLabel,
  actionLabel,
  UNKNOWN_ACTOR_LABEL,
  AUDIT_PAGE_SIZE,
} from './auditLog'
import { EMPTY_AUDIT_FILTERS, type AuditEntry } from '@/types/audit'

function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 'e1',
    actorUserId: null,
    action: 'update',
    resource: 'refund',
    resourceId: 'r1',
    details: null,
    createdAt: '2026-07-01T12:00:00Z',
    ...overrides,
  }
}

describe('buildAuditParams', () => {
  it('always includes the page size limit and nothing else when unfiltered', () => {
    expect(buildAuditParams(EMPTY_AUDIT_FILTERS, '')).toEqual({ limit: AUDIT_PAGE_SIZE })
  })

  it('includes only the filters that are set', () => {
    const params = buildAuditParams(
      { ...EMPTY_AUDIT_FILTERS, resource: 'refund', action: 'update' },
      '',
    )
    expect(params).toEqual({ limit: AUDIT_PAGE_SIZE, resource: 'refund', action: 'update' })
  })

  it('forwards the cursor unchanged — never constructs or mutates it', () => {
    const opaque = 'MjAyNi0wNy0wMVQxMjowMDowMFp8YWJj'
    const params = buildAuditParams(EMPTY_AUDIT_FILTERS, opaque)
    expect(params.cursor).toBe(opaque)
  })

  it('converts from/to day inputs to RFC3339 day-start/day-end instants in local time', () => {
    // The instants are anchored to the browser's local timezone (the day
    // input represents a local calendar day), so the expected value is
    // derived the same way rather than hardcoding a UTC offset.
    const params = buildAuditParams(
      { ...EMPTY_AUDIT_FILTERS, from: '2026-07-01', to: '2026-07-02' },
      '',
    )
    expect(params.from).toBe(new Date('2026-07-01T00:00:00.000').toISOString())
    expect(params.to).toBe(new Date('2026-07-02T23:59:59.999').toISOString())
  })
})

describe('hasActiveFilters', () => {
  it('is false for the empty filter set', () => {
    expect(hasActiveFilters(EMPTY_AUDIT_FILTERS)).toBe(false)
  })

  it('is true when any single field is set', () => {
    expect(hasActiveFilters({ ...EMPTY_AUDIT_FILTERS, actor: 'u1' })).toBe(true)
  })
})

describe('dayStartRfc3339 / dayEndRfc3339', () => {
  it('returns undefined for a blank day', () => {
    expect(dayStartRfc3339('')).toBeUndefined()
    expect(dayEndRfc3339('')).toBeUndefined()
  })

  it('returns undefined for an unparseable day', () => {
    expect(dayStartRfc3339('not-a-date')).toBeUndefined()
  })
})

describe('detailsEmployeeId', () => {
  it.each([
    [{ employee_id: 42 }, 42],
    [{ employee_id: 0 }, 0],
    [{}, null],
    [null, null],
    [undefined, null],
    [{ employee_id: 'abc' }, null],
    ['not-an-object', null],
  ])('detailsEmployeeId(%p) -> %p', (input, expected) => {
    expect(detailsEmployeeId(input)).toBe(expected)
  })
})

describe('actorLabel', () => {
  it('resolves a known user by id', () => {
    const e = entry({ actorUserId: 'u1' })
    expect(actorLabel(e, { u1: 'Jordan Lee' })).toBe('Jordan Lee')
  })

  it('falls back to the raw id when the user is not in the map', () => {
    const e = entry({ actorUserId: 'u-unknown' })
    expect(actorLabel(e, {})).toBe('u-unknown')
  })

  it('falls back to the employee id from details on the v2 employee path', () => {
    const e = entry({ actorUserId: null, details: { employee_id: 7 } })
    expect(actorLabel(e, {})).toBe('Employee #7')
  })

  it('falls back to System when neither a user nor an employee id is present', () => {
    const e = entry({ actorUserId: null, details: null })
    expect(actorLabel(e, {})).toBe(UNKNOWN_ACTOR_LABEL)
  })
})

describe('isRawActorId', () => {
  it('is true when the actor id has no resolved name', () => {
    expect(isRawActorId(entry({ actorUserId: 'u1' }), {})).toBe(true)
  })

  it('is false when resolved or when there is no actor id at all', () => {
    expect(isRawActorId(entry({ actorUserId: 'u1' }), { u1: 'Name' })).toBe(false)
    expect(isRawActorId(entry({ actorUserId: null }), {})).toBe(false)
  })
})

describe('formatDetails', () => {
  it('pretty-prints an object', () => {
    expect(formatDetails({ a: 1 })).toBe('{\n  "a": 1\n}')
  })

  it('returns empty string for null/undefined', () => {
    expect(formatDetails(null)).toBe('')
    expect(formatDetails(undefined)).toBe('')
  })
})

describe('humanizeToken', () => {
  it.each([
    ['sales_order', 'Sales Order'],
    ['refund', 'Refund'],
    ['credit_memo', 'Credit Memo'],
    ['attachment.upload', 'Attachment Upload'],
    ['', ''],
  ])('humanizeToken(%p) -> %p', (input, expected) => {
    expect(humanizeToken(input)).toBe(expected)
  })
})

describe('resourceLabel', () => {
  it('returns the curated label for a known resource', () => {
    expect(resourceLabel('sales_order')).toBe('Sales Order')
    expect(resourceLabel('record_attachment')).toBe('Attachment')
  })

  it('falls back to a humanized token for an unlisted resource', () => {
    expect(resourceLabel('new_module')).toBe('New Module')
  })
})

describe('actionLabel', () => {
  it('returns the curated label for a known action', () => {
    expect(actionLabel('unapply')).toBe('Unapply')
    expect(actionLabel('attachment.download')).toBe('Attachment Download')
  })

  it('falls back to a humanized token for an unlisted action', () => {
    expect(actionLabel('reissue')).toBe('Reissue')
  })
})
