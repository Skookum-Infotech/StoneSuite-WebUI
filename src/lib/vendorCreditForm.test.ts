import { describe, it, expect } from 'vitest';
import {
  toCreatePayload,
  toUpdatePayload,
  fromVendorCredit,
  vcTransitionLabel,
  vcStatusLabel,
  transitionPermission,
  applyBlockedReason,
  validateVendorCreditCustomFields,
  VC_ALLOWED_TRANSITIONS,
  VC_EDITABLE_STATUSES,
  VC_APPLIABLE_STATUSES,
  EDIT_FIELDS,
  PRIMARY_INFO_FIELDS,
} from './vendorCreditForm';
import type { VendorCredit } from '@/types/vendorCredit';
import type { FieldDefinition } from '@/types/tenant';

describe('toCreatePayload', () => {
  it('maps form state onto the create contract', () => {
    const payload = toCreatePayload(
      {
        credit_date: '2026-08-13',
        reference_num: 'RMA-4471',
        amount: '850.00',
        reason: 'Returned defective slab',
        owner_employee: '7',
        memo: 'Handled by receiving',
        internal_notes: 'confirmed with vendor',
      },
      'vendor-uuid-1',
      { po_ref: 'PO-42' },
    );

    expect(payload).toEqual({
      vendorUuid: 'vendor-uuid-1',
      referenceNumber: 'RMA-4471',
      creditDate: '2026-08-13',
      reason: 'Returned defective slab',
      memo: 'Handled by receiving',
      internalNotes: 'confirmed with vendor',
      ownerEmployeeId: 7,
      amount: 850,
      customFields: { po_ref: 'PO-42' },
    });
  });

  it('sends null (not 0) for a blank owner select, and omits a blank date', () => {
    const payload = toCreatePayload(
      { amount: '10', owner_employee: '', credit_date: '' },
      'vendor-uuid-2',
    );
    expect(payload.ownerEmployeeId).toBeNull();
    expect(payload.creditDate).toBeUndefined();
    expect(payload.customFields).toEqual({});
  });

  it('falls back to 0 for an unparseable amount rather than NaN', () => {
    const payload = toCreatePayload({ amount: 'abc' }, 'vendor-uuid-3');
    expect(payload.amount).toBe(0);
  });
});

describe('toUpdatePayload', () => {
  it('carries amount (editable via PATCH while Draft), unlike Vendor Payment', () => {
    const payload = toUpdatePayload(
      { amount: '999', reference_num: 'X', credit_date: '2026-08-13' },
      {},
    );
    expect(payload).not.toHaveProperty('vendorUuid');
    expect(payload.amount).toBe(999);
    expect(payload.referenceNumber).toBe('X');
  });
});

describe('fromVendorCredit', () => {
  const credit: VendorCredit = {
    id: 'vc-1',
    vendorCreditNumber: 'VCR-000004',
    status: 'Draft',
    statusCode: 'DRFT',
    approvalStatus: 'none',
    gated: false,
    approvers: [],
    requiredApprovals: 0,
    approvedCount: 0,
    canApprove: false,
    isOverride: false,
    callerAlreadyApproved: false,
    vendor: { id: 'v-1', name: 'Granite Supply Co' },
    ownerEmployeeId: 7,
    referenceNumber: 'RMA-4471',
    reason: 'Returned defective slab',
    memo: 'partial',
    internalNotes: '',
    creditDate: '2026-08-13T00:00:00Z',
    grandTotal: 850,
    appliedTotal: 200,
    unappliedAmount: 650,
    customFields: { po_ref: 'PO-42' },
    applications: [],
  };

  it('round-trips through toUpdatePayload without blanking any header field', () => {
    const { data, vendor, customFieldValues } = fromVendorCredit(credit);
    expect(vendor).toEqual({ id: 'v-1', name: 'Granite Supply Co' });
    expect(customFieldValues).toEqual({ po_ref: 'PO-42' });

    const payload = toUpdatePayload(data, customFieldValues);
    expect(payload).toEqual({
      referenceNumber: 'RMA-4471',
      creditDate: '2026-08-13',
      reason: 'Returned defective slab',
      memo: 'partial',
      internalNotes: '',
      ownerEmployeeId: 7,
      amount: 850,
      customFields: { po_ref: 'PO-42' },
    });
  });

  it('strips the time component off the credit date for the date input', () => {
    const { data } = fromVendorCredit(credit);
    expect(data.credit_date).toBe('2026-08-13');
  });

  it('renders an absent owner as the empty select value, never "null"', () => {
    const { data } = fromVendorCredit({ ...credit, ownerEmployeeId: null });
    expect(data.owner_employee).toBe('');
  });
});

describe('transition map', () => {
  it('omits APPV->APPL — that edge is reached only through Apply, never a button', () => {
    expect(VC_ALLOWED_TRANSITIONS.APPV).toEqual(['VOID']);
  });

  it('offers the backend map verbatim otherwise', () => {
    const cases: [string, string[]][] = [
      ['DRFT', ['APPV', 'VOID']],
      ['APPV', ['VOID']],
      ['APPL', []],
      ['VOID', []],
    ];
    for (const [from, expected] of cases) {
      expect(VC_ALLOWED_TRANSITIONS[from]).toEqual(expected);
    }
  });

  it('labels the void edge "Void", not "Cancel"', () => {
    expect(vcTransitionLabel('DRFT', 'VOID')).toBe('Void');
    expect(vcTransitionLabel('APPV', 'VOID')).toBe('Void');
    expect(vcTransitionLabel('DRFT', 'APPV')).toBe('Approve');
    expect(vcTransitionLabel('SCHD', 'NOPE')).toBe('NOPE');
  });

  it('resolves human status labels, falling back to the raw code', () => {
    expect(vcStatusLabel('APPL')).toBe('Applied');
    expect(vcStatusLabel('ZZZZ')).toBe('ZZZZ');
  });
});

describe('transitionPermission', () => {
  it('gates only DRFT->APPV behind approve; every other move rides transition', () => {
    expect(transitionPermission('APPV')).toBe('approve');
    expect(transitionPermission('VOID')).toBe('transition');
  });
});

describe('applyBlockedReason', () => {
  it('explains why apply is unavailable, or returns null when it is available', () => {
    expect(applyBlockedReason('DRFT', 500)).toMatch(/approve/i);
    expect(applyBlockedReason('VOID', 500)).toMatch(/voided/i);
    expect(applyBlockedReason('APPV', 0)).toMatch(/no unapplied balance/i);
    expect(applyBlockedReason('APPV', 500)).toBeNull();
    expect(applyBlockedReason('APPL', 100)).toBeNull();
  });
});

describe('status-driven gates', () => {
  it('allows edits only while Draft — stricter than Vendor Payment\'s DRFT/PAPV window', () => {
    expect([...VC_EDITABLE_STATUSES]).toEqual(['DRFT']);
  });

  it('allows apply only from Approved or Applied', () => {
    expect([...VC_APPLIABLE_STATUSES].sort()).toEqual(['APPL', 'APPV']);
  });
});

describe('field definitions', () => {
  it('keeps amount editable on both Create and Edit, unlike Vendor Payment', () => {
    expect(PRIMARY_INFO_FIELDS.some((f) => f.key === 'amount')).toBe(true);
    expect(EDIT_FIELDS.some((f) => f.key === 'amount')).toBe(true);
    expect(EDIT_FIELDS).toEqual(PRIMARY_INFO_FIELDS);
  });
});

describe('validateVendorCreditCustomFields', () => {
  const defs = [
    { id: '1', key: 'po_ref', label: 'PO Reference', type: 'text', required: true },
    { id: '2', key: 'note', label: 'Note', type: 'text', required: false },
  ] as unknown as FieldDefinition[];

  it('reports only required fields that are empty', () => {
    expect(validateVendorCreditCustomFields(defs, { po_ref: 'PO-1' })).toEqual([]);
    expect(validateVendorCreditCustomFields(defs, {})).toEqual([{ key: 'po_ref', label: 'PO Reference' }]);
    expect(validateVendorCreditCustomFields(defs, { po_ref: '' })).toEqual([{ key: 'po_ref', label: 'PO Reference' }]);
    expect(validateVendorCreditCustomFields(defs, { po_ref: null })).toEqual([{ key: 'po_ref', label: 'PO Reference' }]);
  });
});
