import { describe, it, expect } from 'vitest'
import {
  isTerminalStatus, canHold, canCancel, canDeleteJob, needsApproval,
  toJobFields, toPieceInput, fromJob, FJ_STATUS_CODES, FJ_LINEAR_TRANSITIONS,
} from './fabricationForm'
import type { FabricationJob } from '@/types/fabrication'

describe('isTerminalStatus', () => {
  it.each([
    ['COMP', true],
    ['CANC', true],
    ['DRFT', false],
    ['HOLD', false],
    ['CUTG', false],
  ])('isTerminalStatus(%p) -> %p', (code, expected) => {
    expect(isTerminalStatus(code)).toBe(expected)
  })
})

describe('canHold', () => {
  it.each([
    ['DRFT', true],
    ['CUTG', true],
    ['QCPD', true],
    ['HOLD', false],
    ['COMP', false],
    ['CANC', false],
  ])('canHold(%p) -> %p', (code, expected) => {
    expect(canHold(code)).toBe(expected)
  })
})

describe('canCancel', () => {
  it.each([
    ['DRFT', true],
    ['CUTG', true],
    ['HOLD', true],
    ['COMP', false],
    ['CANC', false],
  ])('canCancel(%p) -> %p', (code, expected) => {
    expect(canCancel(code)).toBe(expected)
  })
})

describe('canDeleteJob', () => {
  it.each([
    ['DRFT', true],
    ['CANC', true],
    ['ORCV', false],
    ['COMP', false],
    ['HOLD', false],
  ])('canDeleteJob(%p) -> %p', (code, expected) => {
    expect(canDeleteJob(code)).toBe(expected)
  })
})

describe('needsApproval', () => {
  it.each([
    ['none', false],
    ['pending', true],
    ['approved', false],
  ])('needsApproval({approvalStatus: %p}) -> %p', (approvalStatus, expected) => {
    expect(needsApproval({ approvalStatus: approvalStatus as FabricationJob['approvalStatus'] })).toBe(expected)
  })
})

describe('FJ_LINEAR_TRANSITIONS', () => {
  it('covers every status code exactly once', () => {
    const codes = FJ_STATUS_CODES.map((s) => s.code)
    expect(Object.keys(FJ_LINEAR_TRANSITIONS).sort()).toEqual([...codes].sort())
  })

  it('excludes HOLD and CANC as targets everywhere (they are dedicated controls, not dropdown options)', () => {
    for (const targets of Object.values(FJ_LINEAR_TRANSITIONS)) {
      expect(targets).not.toContain('HOLD')
      expect(targets).not.toContain('CANC')
    }
  })

  it('keeps the QCPD -> EDGP rework edge alongside the forward QCPD -> QCPS move', () => {
    expect(FJ_LINEAR_TRANSITIONS.QCPD).toEqual(['QCPS', 'EDGP'])
  })

  it('has no outbound moves from COMP, HOLD, or CANC', () => {
    expect(FJ_LINEAR_TRANSITIONS.COMP).toEqual([])
    expect(FJ_LINEAR_TRANSITIONS.HOLD).toEqual([])
    expect(FJ_LINEAR_TRANSITIONS.CANC).toEqual([])
  })
})

describe('toJobFields', () => {
  it('maps flat form data to the header payload, dropping blanks to undefined', () => {
    const fields = toJobFields({
      siteCustomerName: 'Acme Corp',
      siteAddrLine1: '123 Main St',
      siteCity: 'Springfield',
      siteStateId: '5',
      siteZip: '62701',
      templateDate: '2026-08-01',
      ownerEmployeeId: '7',
      notes: 'Rush job',
    })
    expect(fields).toMatchObject({
      siteCustomerName: 'Acme Corp',
      siteAddrLine1: '123 Main St',
      siteAddrLine2: undefined,
      siteCity: 'Springfield',
      siteStateId: 5,
      siteZip: '62701',
      templateDate: '2026-08-01',
      fabricationStart: undefined,
      ownerEmployeeId: 7,
      templaterEmployeeId: null,
      notes: 'Rush job',
      customFields: {},
    })
  })

  it('maps an unset employee select to null, not 0', () => {
    const fields = toJobFields({ ownerEmployeeId: '' })
    expect(fields.ownerEmployeeId).toBeNull()
  })
})

describe('toPieceInput', () => {
  it('parses numeric strings and defaults blanks to 0', () => {
    const input = toPieceInput({
      id: 'p-1', pieceNumber: 1, pieceName: 'Island Top', pieceType: 'countertop',
      lengthMm: '2400', widthMm: '', thicknessMm: '30', sinkCutoutCount: '1', cooktopCutoutCount: '', seamCount: '0',
    })
    expect(input).toEqual({
      pieceNumber: 1, pieceName: 'Island Top', pieceType: 'countertop',
      lengthMm: 2400, widthMm: 0, thicknessMm: 30,
      sinkCutoutCount: 1, cooktopCutoutCount: 0, seamCount: 0,
      salesOrderItemUuid: undefined,
    })
  })

  it('carries salesOrderItemUuid through when linked to a sales order line', () => {
    const input = toPieceInput({
      id: 'p-2', pieceNumber: 2, pieceName: 'Backsplash', pieceType: 'backsplash',
      lengthMm: '1200', widthMm: '600', thicknessMm: '20',
      sinkCutoutCount: '0', cooktopCutoutCount: '0', seamCount: '0',
      salesOrderItemUuid: 'soi-uuid-1',
    })
    expect(input.salesOrderItemUuid).toBe('soi-uuid-1')
  })
})

describe('fromJob', () => {
  const job: FabricationJob = {
    id: 'job-1',
    jobNumber: 'FJOB-000001',
    status: 'Material Allocated',
    statusCode: 'MALC',
    approvalStatus: 'none',
    salesOrderId: 'so-1',
    customer: { id: 'cust-1', name: 'Acme Corp' },
    cancelRequested: false,
    site: {
      customerName: 'Acme Corp', addrLine1: '123 Main St', city: 'Springfield',
      stateId: 5, zip: '62701', phone: '555-0100',
    },
    templateDate: '2026-08-01',
    ownerEmployeeId: 7,
    templaterEmployeeId: null,
    fabricatorEmployeeId: null,
    installCrewEmployeeId: null,
    notes: 'Rush job',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-02T00:00:00Z',
  }

  it('maps a loaded job back to editable form state', () => {
    const data = fromJob(job)
    expect(data).toMatchObject({
      siteCustomerName: 'Acme Corp',
      siteAddrLine1: '123 Main St',
      siteCity: 'Springfield',
      siteStateId: '5',
      siteZip: '62701',
      sitePhone: '555-0100',
      templateDate: '2026-08-01',
      ownerEmployeeId: '7',
      templaterEmployeeId: '',
      notes: 'Rush job',
    })
  })
})
