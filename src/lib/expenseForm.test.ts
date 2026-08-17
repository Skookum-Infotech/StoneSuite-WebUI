import { describe, it, expect } from 'vitest'
import {
  EXPENSE_ALLOWED_TRANSITIONS,
  EXPENSE_DELETABLE_STATUSES,
  EXPENSE_NON_DRAFT_LOCKED,
  calcHeaderTotal,
  canRejectExpense,
  categoryNameForCode,
  expStatusLabel,
  expTransitionLabel,
  invalidLinePositions,
  isExpTransitionBlocked,
  toCreatePayload,
  type ExpenseLineItem,
} from './expenseForm'

// Test helper — a line row with sensible blanks, overridden per case.
function line(over: Partial<ExpenseLineItem> = {}): ExpenseLineItem {
  return {
    id: 'l1', lineNo: 1, categoryCode: '', categoryName: '',
    expenseDate: '', amount: '', description: '', ...over,
  }
}

describe('EXPENSE_ALLOWED_TRANSITIONS', () => {
  // Mirrors expense/transitions.go's allowedTransitions map. If the backend
  // map changes, this table is the thing that should fail first. SUBM
  // deliberately excludes RJCT -- rejection only ever goes through the
  // dedicated Reject endpoint (spec AD-5).
  it.each([
    ['DRFT', ['SUBM']],
    ['SUBM', ['APPV', 'DRFT']],
    ['APPV', ['REIM']],
    ['RJCT', ['DRFT']],
    ['REIM', []],
  ])('from %p -> %p', (from, expected) => {
    expect(EXPENSE_ALLOWED_TRANSITIONS[from]).toEqual(expected)
  })

  it('offers no transitions from an unknown status', () => {
    expect(EXPENSE_ALLOWED_TRANSITIONS['NOPE']).toBeUndefined()
  })

  it('never lists RJCT as a generic transition target from SUBM', () => {
    expect(EXPENSE_ALLOWED_TRANSITIONS['SUBM']).not.toContain('RJCT')
  })
})

describe('isExpTransitionBlocked', () => {
  // The approval gate gets one carve-out: recalling to DRFT is how a
  // submitter withdraws a pending claim without an approver's sign-off.
  it.each([
    ['SUBM', 'APPV', 'pending', true],
    ['SUBM', 'DRFT', 'pending', false],
    ['SUBM', 'APPV', 'approved', false],
    ['DRFT', 'SUBM', 'none', false],
  ])('%s -> %s while %s blocks: %p', (_from, to, approvalStatus, expected) => {
    expect(isExpTransitionBlocked(to, approvalStatus)).toBe(expected)
  })
})

describe('expTransitionLabel', () => {
  it('distinguishes recall from revise, which share a target status', () => {
    expect(expTransitionLabel('SUBM', 'DRFT')).toBe('Recall to Draft')
    expect(expTransitionLabel('RJCT', 'DRFT')).toBe('Revise')
  })

  it('falls back to the raw target code for an unmapped pair', () => {
    expect(expTransitionLabel('DRFT', 'ZZZZ')).toBe('ZZZZ')
  })
})

describe('expStatusLabel', () => {
  it.each([
    ['DRFT', 'Draft'],
    ['SUBM', 'Submitted'],
    ['APPV', 'Approved'],
    ['RJCT', 'Rejected'],
    ['REIM', 'Reimbursed'],
    ['ZZZZ', 'ZZZZ'],
  ])('%p -> %p', (code, expected) => {
    expect(expStatusLabel(code)).toBe(expected)
  })
})

describe('canRejectExpense', () => {
  it.each([
    ['SUBM', true],
    ['DRFT', false],
    ['APPV', false],
    ['RJCT', false],
    ['REIM', false],
  ])('%p -> %p', (code, expected) => {
    expect(canRejectExpense(code)).toBe(expected)
  })
})

describe('calcHeaderTotal', () => {
  // Mirrors expense/calc.go's ComputeHeaderTotal: a plain sum of line
  // amounts, rounded once at the end -- no per-line rounding, no qty*price.
  it('sums line amounts directly', () => {
    expect(calcHeaderTotal([line({ amount: '412.50' }), line({ amount: '38.20' })])).toBe(450.7)
  })

  it('treats a blank/invalid amount as zero', () => {
    expect(calcHeaderTotal([line({ amount: '' }), line({ amount: 'abc' }), line({ amount: '10' })])).toBe(10)
  })

  it('returns zero for no lines', () => {
    expect(calcHeaderTotal([])).toBe(0)
  })

  it('rounds the final sum to 2dp', () => {
    expect(calcHeaderTotal([line({ amount: '1.005' }), line({ amount: '1.005' })])).toBe(2.01)
  })
})

describe('EXPENSE_NON_DRAFT_LOCKED', () => {
  it.each([
    ['DRFT', false],
    ['SUBM', true],
    ['APPV', true],
    ['RJCT', true],
    ['REIM', true],
  ])('%p locked: %p', (code, expected) => {
    expect(EXPENSE_NON_DRAFT_LOCKED(code)).toBe(expected)
  })
})

describe('EXPENSE_DELETABLE_STATUSES', () => {
  // Unlike Requisition, only DRFT is deletable here -- there is no
  // cancelled-equivalent state on an expense claim.
  it.each([
    ['DRFT', true],
    ['SUBM', false],
    ['APPV', false],
    ['RJCT', false],
    ['REIM', false],
  ])('has(%p) -> %p', (code, expected) => {
    expect(EXPENSE_DELETABLE_STATUSES.has(code)).toBe(expected)
  })
})

describe('invalidLinePositions', () => {
  it('accepts a line with a category, a date, and a non-negative amount', () => {
    expect(invalidLinePositions([
      line({ categoryCode: 'TRAVEL', expenseDate: '2026-08-10', amount: '10' }),
    ])).toEqual([])
  })

  it('accepts a zero amount', () => {
    expect(invalidLinePositions([
      line({ categoryCode: 'TRAVEL', expenseDate: '2026-08-10', amount: '0' }),
    ])).toEqual([])
  })

  it('reports 1-based positions of rows missing category, date, or a valid amount', () => {
    expect(invalidLinePositions([
      line({ categoryCode: 'TRAVEL', expenseDate: '2026-08-10', amount: '10' }), // valid
      line({ expenseDate: '2026-08-10', amount: '10' }),                         // no category
      line({ categoryCode: 'MEALS', amount: '10' }),                             // no date
      line({ categoryCode: 'MEALS', expenseDate: '2026-08-10', amount: '-5' }),  // negative amount
    ])).toEqual([2, 3, 4])
  })
})

describe('categoryNameForCode', () => {
  const categories = [
    { id: 1, code: 'TRAVEL', name: 'Travel' },
    { id: 2, code: 'MEALS', name: 'Meals' },
  ]

  it('resolves a known code to its display name', () => {
    expect(categoryNameForCode(categories, 'MEALS')).toBe('Meals')
  })

  it('returns empty string for an unknown code', () => {
    expect(categoryNameForCode(categories, 'ZZZZ')).toBe('')
  })
})

describe('toCreatePayload', () => {
  it('maps the header, omitting the claimant (server always resolves it)', () => {
    const payload = toCreatePayload({ department: 'Sales', memo: 'Client visit' }, [])
    expect(payload).toMatchObject({ department: 'Sales', memo: 'Client visit', items: [] })
    expect(payload).not.toHaveProperty('claimantEmployeeId')
  })

  it('maps and renumbers line items sequentially regardless of stored lineNo', () => {
    const payload = toCreatePayload({}, [
      line({ id: 'a', lineNo: 7, categoryCode: 'TRAVEL', expenseDate: '2026-08-10', amount: '412.5', description: 'Flight' }),
      line({ id: 'b', lineNo: 3, categoryCode: 'MEALS', expenseDate: '2026-08-10', amount: '38.2' }),
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, categoryCode: 'TRAVEL', expenseDate: '2026-08-10', amount: 412.5, description: 'Flight' },
      { lineNumber: 2, categoryCode: 'MEALS', expenseDate: '2026-08-10', amount: 38.2, description: undefined },
    ])
  })

  it('sends undefined rather than empty string for a blank description', () => {
    const payload = toCreatePayload({}, [
      line({ categoryCode: 'OTHER', expenseDate: '2026-08-10', amount: '5', description: '   ' }),
    ])
    expect(payload.items[0].description).toBeUndefined()
  })
})
