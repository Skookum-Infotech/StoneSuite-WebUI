import { describe, it, expect } from 'vitest'
import {
  feedbackCategoryLabel,
  feedbackStatusLabel,
  feedbackPriorityLabel,
  feedbackAreaLabel,
  resolveFeedbackArea,
  validateFeedbackDescription,
  validateFeedbackComment,
  validateFeedbackFile,
  formatFeedbackFileSize,
  formatFeedbackTime,
  extractAssigneeCandidates,
  MAX_DESCRIPTION_LENGTH,
  MAX_COMMENT_LENGTH,
  MAX_FEEDBACK_FILE_SIZE_BYTES,
  FEEDBACK_CATEGORY_OPTIONS,
  FEEDBACK_AREA_OPTIONS,
} from './feedback'
import type { FeedbackTicket } from '@/types/feedback'

function makeTicket(overrides: Partial<FeedbackTicket>): FeedbackTicket {
  return {
    id: 't1',
    ticketSeq: 1,
    ticketNumber: 'FB-1',
    tenantId: 'tenant-1',
    reporterKind: 'staff',
    reporterEmail: 'reporter@example.com',
    reporterName: 'Reporter',
    category: 'bug',
    description: 'Something broke',
    status: 'new',
    priority: 'normal',
    reporterLastSeenAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('feedbackCategoryLabel', () => {
  it('resolves every curated category', () => {
    for (const opt of FEEDBACK_CATEGORY_OPTIONS) {
      expect(feedbackCategoryLabel(opt.value)).toBe(opt.label)
    }
  })

  it('falls back to the raw value for an unknown category', () => {
    expect(feedbackCategoryLabel('made_up')).toBe('made_up')
  })
})

describe('feedbackStatusLabel', () => {
  it.each([
    ['new', 'New'],
    ['in_progress', 'In Progress'],
    ['done', 'Done'],
    ['cancelled', 'Cancelled'],
  ])('labels %s as %s', (status, label) => {
    expect(feedbackStatusLabel(status)).toBe(label)
  })

  it('falls back to the raw value for an unknown status', () => {
    expect(feedbackStatusLabel('archived')).toBe('archived')
  })
})

describe('feedbackPriorityLabel', () => {
  it.each([
    ['low', 'Low'],
    ['normal', 'Normal'],
    ['high', 'High'],
    ['urgent', 'Urgent'],
  ])('labels %s as %s', (priority, label) => {
    expect(feedbackPriorityLabel(priority)).toBe(label)
  })
})

describe('feedbackAreaLabel', () => {
  it('resolves every curated area', () => {
    for (const opt of FEEDBACK_AREA_OPTIONS) {
      expect(feedbackAreaLabel(opt.value)).toBe(opt.label)
    }
  })

  it('falls back to the raw value for an unknown area', () => {
    expect(feedbackAreaLabel('made_up')).toBe('made_up')
  })

  it('returns empty string for undefined', () => {
    expect(feedbackAreaLabel(undefined)).toBe('')
  })
})

describe('resolveFeedbackArea', () => {
  it.each([
    ['/dashboard', 'dashboard'],
    ['/crm/lead/123', 'crm'],
    ['/sales/sales_order', 'sales'],
    ['/purchases/vendor', 'purchases'],
    ['/inventory/item', 'inventory'],
    ['/finance/chart-of-accounts', 'finance'],
    ['/config/workflows', 'configuration'],
    ['/account/settings', 'account'],
    ['/subscription', 'account'],
    ['/transactions', 'other'],
    ['/', 'other'],
  ])('resolves %s to %s', (pathname, area) => {
    expect(resolveFeedbackArea(pathname)).toBe(area)
  })
})

describe('validateFeedbackDescription', () => {
  it('accepts a normal description', () => {
    expect(validateFeedbackDescription('The submit button does nothing.')).toBeNull()
  })

  it('rejects an empty description', () => {
    expect(validateFeedbackDescription('')).not.toBeNull()
  })

  it('rejects a whitespace-only description', () => {
    expect(validateFeedbackDescription('   ')).not.toBeNull()
  })

  it('rejects a description over the length cap', () => {
    expect(validateFeedbackDescription('a'.repeat(MAX_DESCRIPTION_LENGTH + 1))).not.toBeNull()
  })

  it('accepts a description exactly at the length cap', () => {
    expect(validateFeedbackDescription('a'.repeat(MAX_DESCRIPTION_LENGTH))).toBeNull()
  })
})

describe('validateFeedbackComment', () => {
  it('accepts a normal reply', () => {
    expect(validateFeedbackComment('Thanks, looking into it.')).toBeNull()
  })

  it('rejects an empty reply', () => {
    expect(validateFeedbackComment('')).not.toBeNull()
  })

  it('rejects a reply over the length cap', () => {
    expect(validateFeedbackComment('a'.repeat(MAX_COMMENT_LENGTH + 1))).not.toBeNull()
  })
})

describe('validateFeedbackFile', () => {
  it('accepts an allowed type within the size cap', () => {
    expect(validateFeedbackFile(makeFile('screenshot.png', 'image/png', 1024))).toBeNull()
  })

  it('rejects a disallowed type', () => {
    expect(validateFeedbackFile(makeFile('script.exe', 'application/x-msdownload', 1024))).not.toBeNull()
  })

  it('rejects a file over the size cap', () => {
    expect(
      validateFeedbackFile(makeFile('big.png', 'image/png', MAX_FEEDBACK_FILE_SIZE_BYTES + 1)),
    ).not.toBeNull()
  })

  it('accepts a file exactly at the size cap', () => {
    expect(validateFeedbackFile(makeFile('exact.png', 'image/png', MAX_FEEDBACK_FILE_SIZE_BYTES))).toBeNull()
  })
})

describe('formatFeedbackFileSize', () => {
  it.each([
    [500, '500 B'],
    [2048, '2.0 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatFeedbackFileSize(bytes)).toBe(expected)
  })
})

describe('formatFeedbackTime', () => {
  it('returns the raw string for an unparseable value', () => {
    expect(formatFeedbackTime('not-a-date')).toBe('not-a-date')
  })

  it('formats a valid ISO timestamp', () => {
    const result = formatFeedbackTime('2026-01-15T10:30:00Z')
    expect(result).not.toBe('2026-01-15T10:30:00Z')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('extractAssigneeCandidates', () => {
  it('returns an empty list with no tickets and no self', () => {
    expect(extractAssigneeCandidates([])).toEqual([])
  })

  it('includes self first even with zero prior assignments', () => {
    const result = extractAssigneeCandidates([], { id: 'me', name: 'Me' })
    expect(result).toEqual([{ id: 'me', name: 'Me' }])
  })

  it('dedups repeated assignees across tickets', () => {
    const tickets = [
      makeTicket({ id: 't1', assignedAdminIdentityId: 'a1', assignedAdminName: 'Alice' }),
      makeTicket({ id: 't2', assignedAdminIdentityId: 'a1', assignedAdminName: 'Alice' }),
      makeTicket({ id: 't3', assignedAdminIdentityId: 'a2', assignedAdminName: 'Bob' }),
    ]
    expect(extractAssigneeCandidates(tickets)).toEqual([
      { id: 'a1', name: 'Alice' },
      { id: 'a2', name: 'Bob' },
    ])
  })

  it('skips unassigned tickets', () => {
    const tickets = [makeTicket({ id: 't1', assignedAdminIdentityId: undefined })]
    expect(extractAssigneeCandidates(tickets)).toEqual([])
  })

  it('sorts non-self candidates alphabetically by name', () => {
    const tickets = [
      makeTicket({ id: 't1', assignedAdminIdentityId: 'a1', assignedAdminName: 'Zed' }),
      makeTicket({ id: 't2', assignedAdminIdentityId: 'a2', assignedAdminName: 'Amy' }),
    ]
    expect(extractAssigneeCandidates(tickets).map((c) => c.name)).toEqual(['Amy', 'Zed'])
  })

  it('does not duplicate self when self already appears among tickets', () => {
    const tickets = [makeTicket({ id: 't1', assignedAdminIdentityId: 'me', assignedAdminName: 'Me' })]
    const result = extractAssigneeCandidates(tickets, { id: 'me', name: 'Me' })
    expect(result).toEqual([{ id: 'me', name: 'Me' }])
  })

  it('falls back to the identity id when assignedAdminName is missing', () => {
    const tickets = [makeTicket({ id: 't1', assignedAdminIdentityId: 'a1', assignedAdminName: undefined })]
    expect(extractAssigneeCandidates(tickets)).toEqual([{ id: 'a1', name: 'a1' }])
  })
})
