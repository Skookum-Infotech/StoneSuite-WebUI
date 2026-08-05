import { describe, it, expect } from 'vitest'
import {
  REQUISITION_ALLOWED_TRANSITIONS,
  REQN_DELETABLE_STATUSES,
  REQN_NON_DRAFT_LOCKED,
  calcHeaderTotals,
  calcLineAmount,
  calcLineItem,
  canConvertToPurchaseOrder,
  clampPercent,
  invalidLinePositions,
  isReqnTransitionBlocked,
  reqnStatusLabel,
  reqnTransitionLabel,
  toCreatePayload,
  toPriorityValue,
  type RequisitionLineItem,
} from './requisitionForm'

// Test helper — a line row with sensible blanks, overridden per case.
function line(over: Partial<RequisitionLineItem> = {}): RequisitionLineItem {
  return {
    id: 'l1', lineNo: 1, itemName: '', itemDescription: '',
    quantity: '', estimatedUnitPrice: '', amount: '', ...over,
  }
}

describe('REQUISITION_ALLOWED_TRANSITIONS', () => {
  // Mirrors requisition/transitions.go's allowedTransitions map. If the
  // backend map changes, this table is the thing that should fail first.
  it.each([
    ['DRFT', ['PAPV', 'CANC']],
    ['PAPV', ['APPV', 'DRFT', 'CANC']],
    ['APPV', ['DRFT', 'CANC']],
    ['CANC', []],
  ])('from %p -> %p', (from, expected) => {
    expect(REQUISITION_ALLOWED_TRANSITIONS[from]).toEqual(expected)
  })

  it('offers no transitions from an unknown status', () => {
    expect(REQUISITION_ALLOWED_TRANSITIONS['NOPE']).toBeUndefined()
  })
})

describe('isReqnTransitionBlocked', () => {
  // The approval gate gets one carve-out: recalling to DRFT is how a
  // submitter withdraws a pending request without an approver's sign-off.
  it.each([
    ['PAPV', 'APPV', 'pending', true],
    ['PAPV', 'CANC', 'pending', true],
    ['PAPV', 'DRFT', 'pending', false],
    ['PAPV', 'APPV', 'approved', false],
    ['DRFT', 'PAPV', 'none', false],
  ])('%s -> %s while %s blocks: %p', (_from, to, approvalStatus, expected) => {
    expect(isReqnTransitionBlocked(to, approvalStatus)).toBe(expected)
  })
})

describe('reqnTransitionLabel', () => {
  it('distinguishes recall from revise, which share a target status', () => {
    expect(reqnTransitionLabel('PAPV', 'DRFT')).toBe('Recall to Draft')
    expect(reqnTransitionLabel('APPV', 'DRFT')).toBe('Revise')
  })

  it('falls back to the raw target code for an unmapped pair', () => {
    expect(reqnTransitionLabel('DRFT', 'ZZZZ')).toBe('ZZZZ')
  })
})

describe('reqnStatusLabel', () => {
  it.each([
    ['DRFT', 'Draft'],
    ['PAPV', 'Pending Approval'],
    ['APPV', 'Approved'],
    ['CANC', 'Cancelled'],
    ['ZZZZ', 'ZZZZ'],
  ])('%p -> %p', (code, expected) => {
    expect(reqnStatusLabel(code)).toBe(expected)
  })
})

describe('calcLineAmount', () => {
  it.each([
    ['2', '10', 20],
    ['0.5', '9.99', 5],       // 4.995 rounds to 5.00
    ['3', '0.335', 1.01],     // 1.005 -> 1.01
    ['', '10', 0],
    ['2', '', 0],
    ['abc', '10', 0],
  ])('qty %p x price %p -> %p', (quantity, estimatedUnitPrice, expected) => {
    expect(calcLineAmount({ quantity, estimatedUnitPrice })).toBe(expected)
  })
})

describe('calcLineItem', () => {
  it('renders blank until both quantity and price are entered', () => {
    expect(calcLineItem({ quantity: '', estimatedUnitPrice: '10' }).amount).toBe('')
    expect(calcLineItem({ quantity: '2', estimatedUnitPrice: '' }).amount).toBe('')
  })

  it('renders a fixed 2dp amount once both are present', () => {
    expect(calcLineItem({ quantity: '2', estimatedUnitPrice: '10' }).amount).toBe('20.00')
  })
})

describe('calcHeaderTotals', () => {
  it('sums lines, then applies the header tax percent', () => {
    const totals = calcHeaderTotals(
      [line({ quantity: '2', estimatedUnitPrice: '10' }), line({ quantity: '1', estimatedUnitPrice: '5' })],
      10,
    )
    expect(totals).toEqual({ subtotal: 25, taxTotal: 2.5, estimatedTotal: 27.5 })
  })

  it('treats a blank/zero tax percent as no tax', () => {
    const totals = calcHeaderTotals([line({ quantity: '2', estimatedUnitPrice: '10' })], 0)
    expect(totals).toEqual({ subtotal: 20, taxTotal: 0, estimatedTotal: 20 })
  })

  it('returns zeroes for no lines', () => {
    expect(calcHeaderTotals([], 10)).toEqual({ subtotal: 0, taxTotal: 0, estimatedTotal: 0 })
  })

  // Load-bearing: the backend (requisition/calc.go ComputeHeader) rounds each
  // line to 2dp BEFORE summing. Here each line is 3.335 raw -> 3.34 rounded,
  // so the subtotal is 6.68, not round2(6.67) = 6.67. A calc that summed the
  // raw products would report a subtotal one cent below what the server
  // stores, and the drift compounds through tax and total.
  it('rounds each line before summing, not after', () => {
    const totals = calcHeaderTotals(
      [line({ quantity: '1', estimatedUnitPrice: '3.335' }), line({ quantity: '1', estimatedUnitPrice: '3.335' })],
      0,
    )
    expect(totals.subtotal).toBe(6.68)
  })

  // Tax is computed from the *rounded* subtotal, mirroring ComputeHeader's
  // ordering, then rounded itself.
  it('computes tax from the rounded subtotal', () => {
    const totals = calcHeaderTotals([line({ quantity: '3', estimatedUnitPrice: '0.335' })], 7.5)
    expect(totals.subtotal).toBe(1.01)
    expect(totals.taxTotal).toBe(0.08)   // round2(1.01 * 0.075) = round2(0.07575)
    expect(totals.estimatedTotal).toBe(1.09)
  })
})

describe('clampPercent', () => {
  it.each([
    ['', ''],
    ['50', '50'],
    ['150', '100'],
    ['-5', '0'],
    ['abc', 'abc'],   // left alone so the user can keep typing
  ])('%p -> %p', (raw, expected) => {
    expect(clampPercent(raw)).toBe(expected)
  })
})

describe('toPriorityValue', () => {
  it.each([
    ['Urgent', 'urgent'],
    ['Low', 'low'],
    ['high', 'high'],        // already a wire value
    ['HIGH', 'high'],
    ['', 'normal'],
    ['nonsense', 'normal'],  // never send a value the server would reject
  ])('%p -> %p', (input, expected) => {
    expect(toPriorityValue(input)).toBe(expected)
  })
})

describe('canConvertToPurchaseOrder', () => {
  it.each([
    ['APPV', undefined, true],
    ['APPV', 'po-1', false],   // already converted — link to it instead
    ['DRFT', undefined, false],
    ['PAPV', undefined, false],
    ['CANC', undefined, false],
  ])('status %p converted %p -> %p', (statusCode, converted, expected) => {
    expect(canConvertToPurchaseOrder(statusCode, converted)).toBe(expected)
  })
})

describe('REQN_NON_DRAFT_LOCKED', () => {
  it.each([
    ['DRFT', false],
    ['PAPV', true],
    ['APPV', true],
    ['CANC', true],
  ])('%p locked: %p', (code, expected) => {
    expect(REQN_NON_DRAFT_LOCKED(code)).toBe(expected)
  })
})

describe('REQN_DELETABLE_STATUSES', () => {
  it.each([
    ['DRFT', true],
    ['CANC', true],
    ['PAPV', false],
    ['APPV', false],
  ])('has(%p) -> %p', (code, expected) => {
    expect(REQN_DELETABLE_STATUSES.has(code)).toBe(expected)
  })
})

describe('invalidLinePositions', () => {
  it('accepts a catalog line with no typed name', () => {
    expect(invalidLinePositions([line({ inventoryItemUuid: 'inv-1' })])).toEqual([])
  })

  it('accepts a free-text line identified by name or by description alone', () => {
    expect(invalidLinePositions([line({ itemName: 'Custom labor' })])).toEqual([])
    expect(invalidLinePositions([line({ itemDescription: 'Ad-hoc request' })])).toEqual([])
  })

  it('reports 1-based positions of rows with no identity at all', () => {
    expect(invalidLinePositions([
      line({ itemName: 'Widget' }),
      line({ quantity: '2', estimatedUnitPrice: '10' }), // qty only — no identity
      line({ itemName: '   ' }),                          // whitespace is not a name
    ])).toEqual([2, 3])
  })
})

describe('toCreatePayload line item description mapping', () => {
  const baseData: Record<string, unknown> = { priority: 'Normal' }

  it('sends no description for a catalog-picked line with no override', () => {
    const payload = toCreatePayload(baseData, [
      line({ itemName: 'Widget', quantity: '1', estimatedUnitPrice: '10', inventoryItemUuid: 'inv-1' }),
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, inventoryItemUuid: 'inv-1', quantity: 1, estimatedUnitPrice: 10 },
    ])
  })

  it('sends an explicit itemDescription for a catalog-picked line, overriding the catalog item', () => {
    const payload = toCreatePayload(baseData, [
      line({ itemName: 'Widget', itemDescription: 'Blue widget, medium', quantity: '1', estimatedUnitPrice: '10', inventoryItemUuid: 'inv-1' }),
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, inventoryItemUuid: 'inv-1', description: 'Blue widget, medium', quantity: 1, estimatedUnitPrice: 10 },
    ])
  })

  it('falls back to itemName as the description on a free-text line', () => {
    const payload = toCreatePayload(baseData, [
      line({ itemName: 'Custom labor', quantity: '1', estimatedUnitPrice: '10' }),
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, description: 'Custom labor', quantity: 1, estimatedUnitPrice: 10 },
    ])
  })

  it('renumbers lines sequentially regardless of their stored lineNo', () => {
    const payload = toCreatePayload(baseData, [
      line({ id: 'a', lineNo: 7, itemName: 'A' }),
      line({ id: 'b', lineNo: 3, itemName: 'B' }),
    ])
    expect(payload.items.map((i) => i.lineNumber)).toEqual([1, 2])
  })
})

describe('toCreatePayload header mapping', () => {
  it('maps the full header, converting the priority label to its wire value', () => {
    const payload = toCreatePayload({
      requested_by: '42',
      department: 'Fabrication',
      needed_by_date: '2026-09-01',
      priority: 'Urgent',
      memo: 'Rush job',
      vendor_uuid: 'vend-1',
      payment_terms: '3',
      sales_tax_pct: '8.25',
    }, [])

    expect(payload).toMatchObject({
      requestedByEmployeeId: 42,
      department: 'Fabrication',
      neededByDate: '2026-09-01',
      priority: 'urgent',
      memo: 'Rush job',
      vendorUuid: 'vend-1',
      paymentTermsId: 3,
      salesTaxPercent: 8.25,
    })
  })

  it('omits an unset suggested vendor and needed-by date rather than sending empty strings', () => {
    const payload = toCreatePayload({ priority: 'Normal' }, [])
    expect(payload.vendorUuid).toBeUndefined()
    expect(payload.neededByDate).toBeUndefined()
  })

  it('sends a null requestedByEmployeeId when unset, so the server defaults it to the caller', () => {
    const payload = toCreatePayload({ priority: 'Normal' }, [])
    expect(payload.requestedByEmployeeId).toBeNull()
  })

  it('sends a null paymentTermsId when unset rather than 0', () => {
    const payload = toCreatePayload({ priority: 'Normal', payment_terms: '' }, [])
    expect(payload.paymentTermsId).toBeNull()
  })
})
