import { describe, it, expect } from 'vitest';
import {
  toCreatePayload,
  toUpdatePayload,
  fromVendorPayment,
  toRFC3339OrUndefined,
  fromRFC3339DateOnly,
  vpTransitionTargets,
  vpTransitionLabel,
  vpStatusLabel,
  isVpTransitionBlocked,
  isScheduleBlocked,
  validateVendorPaymentCustomFields,
  VP_ALLOWED_TRANSITIONS,
  VP_EDITABLE_STATUSES,
  EDIT_FIELDS,
  PRIMARY_INFO_FIELDS,
} from './vendorPaymentForm';
import type { VendorPayment } from '@/types/vendorPayment';
import type { FieldDefinition } from '@/types/tenant';

describe('vendorPaymentForm date handling', () => {
  it('appends UTC midnight so the Go *time.Time decoder accepts the value', () => {
    const cases: [string, string | undefined][] = [
      ['2026-08-12', '2026-08-12T00:00:00Z'],
      ['', undefined],
    ];
    for (const [input, expected] of cases) {
      expect(toRFC3339OrUndefined(input)).toBe(expected);
    }
  });

  it('strips the time component back off when loading into a date input', () => {
    const cases: [string | null | undefined, string][] = [
      ['2026-08-12T00:00:00Z', '2026-08-12'],
      ['2026-08-12', '2026-08-12'],
      [null, ''],
      [undefined, ''],
    ];
    for (const [input, expected] of cases) {
      expect(fromRFC3339DateOnly(input)).toBe(expected);
    }
  });
});

describe('toCreatePayload', () => {
  it('maps form state onto the create contract', () => {
    const payload = toCreatePayload(
      {
        payment_method: '3',
        reference_num: 'CHK-9001',
        payment_date: '2026-08-12',
        scheduled_date: '2026-08-20',
        currency_id: '1',
        owner_employee: '7',
        amount: '1250.50',
        memo: 'August rent',
        internal_notes: 'approved verbally',
      },
      'vendor-uuid-1',
      { po_ref: 'PO-42' },
    );

    expect(payload).toEqual({
      vendorUuid: 'vendor-uuid-1',
      methodId: 3,
      referenceNumber: 'CHK-9001',
      paymentDate: '2026-08-12T00:00:00Z',
      scheduledDate: '2026-08-20T00:00:00Z',
      currencyId: 1,
      ownerEmployeeId: 7,
      amount: 1250.5,
      memo: 'August rent',
      internalNotes: 'approved verbally',
      customFields: { po_ref: 'PO-42' },
    });
  });

  it('sends null (not 0) for blank optional id selects, and omits blank dates', () => {
    const payload = toCreatePayload(
      { payment_method: '1', payment_date: '2026-08-12', amount: '10', currency_id: '', owner_employee: '', scheduled_date: '' },
      'vendor-uuid-2',
    );
    expect(payload.currencyId).toBeNull();
    expect(payload.ownerEmployeeId).toBeNull();
    expect(payload.scheduledDate).toBeUndefined();
    expect(payload.customFields).toEqual({});
  });

  it('falls back to 0 for an unparseable amount rather than NaN', () => {
    const payload = toCreatePayload({ payment_method: '1', amount: 'abc' }, 'vendor-uuid-3');
    expect(payload.amount).toBe(0);
    expect(payload.methodId).toBe(1);
  });
});

describe('toUpdatePayload', () => {
  it('never carries amount, vendor, or applications — all immutable via PATCH', () => {
    const payload = toUpdatePayload(
      { payment_method: '2', amount: '999', reference_num: 'X', payment_date: '2026-08-12' },
      {},
    );
    expect(payload).not.toHaveProperty('amount');
    expect(payload).not.toHaveProperty('vendorUuid');
    expect(payload).not.toHaveProperty('applications');
    expect(payload.methodId).toBe(2);
  });
});

describe('fromVendorPayment', () => {
  const payment: VendorPayment = {
    id: 'vp-1',
    vendorPaymentNumber: 'VPAY-000004',
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
    methodId: 4,
    method: 'ACH',
    referenceNumber: 'ACH-77',
    paymentDate: '2026-08-12T00:00:00Z',
    scheduledDate: '2026-08-20T00:00:00Z',
    currencyId: null,
    memo: 'partial',
    internalNotes: '',
    amount: 500,
    appliedTotal: 200,
    unappliedAmount: 300,
    customFields: { po_ref: 'PO-42' },
    applications: [],
    refunds: [],
  };

  it('round-trips through toUpdatePayload without blanking any header field', () => {
    const { data, vendor, customFieldValues } = fromVendorPayment(payment);
    expect(vendor).toEqual({ id: 'v-1', name: 'Granite Supply Co' });
    expect(customFieldValues).toEqual({ po_ref: 'PO-42' });

    const payload = toUpdatePayload(data, customFieldValues);
    expect(payload).toEqual({
      methodId: 4,
      referenceNumber: 'ACH-77',
      paymentDate: '2026-08-12T00:00:00Z',
      scheduledDate: '2026-08-20T00:00:00Z',
      currencyId: null,
      ownerEmployeeId: 7,
      memo: 'partial',
      internalNotes: '',
      customFields: { po_ref: 'PO-42' },
    });
  });

  it('renders an absent currency as the empty select value, never "null"', () => {
    const { data } = fromVendorPayment(payment);
    expect(data.currency_id).toBe('');
  });
});

describe('transition map', () => {
  it('hides PAPV→APPV, which only the /approve endpoint can cross', () => {
    expect(VP_ALLOWED_TRANSITIONS.PAPV).toContain('APPV');
    expect(vpTransitionTargets('PAPV')).toEqual(['DRFT', 'VOID']);
  });

  it('offers the backend map verbatim everywhere else', () => {
    const cases: [string, string[]][] = [
      ['DRFT', ['PAPV', 'VOID']],
      ['APPV', ['SCHD', 'SENT', 'VOID']],
      ['SCHD', ['SENT', 'VOID']],
      ['SENT', ['VOID']],
      ['VOID', []],
    ];
    for (const [from, expected] of cases) {
      expect(vpTransitionTargets(from)).toEqual(expected);
    }
  });

  it('labels each edge by its (from, to) pair, falling back to the raw code', () => {
    expect(vpTransitionLabel('DRFT', 'PAPV')).toBe('Submit for Approval');
    expect(vpTransitionLabel('APPV', 'SCHD')).toBe('Schedule Payment');
    expect(vpTransitionLabel('SCHD', 'NOPE')).toBe('NOPE');
  });

  it('resolves human status labels, falling back to the raw code', () => {
    expect(vpStatusLabel('SCHD')).toBe('Scheduled');
    expect(vpStatusLabel('ZZZZ')).toBe('ZZZZ');
  });
});

describe('transition gates', () => {
  it('blocks every move except the recall to draft while approval is pending', () => {
    const cases: [string, string, boolean][] = [
      ['APPV', 'pending', true],
      ['VOID', 'pending', true],
      ['DRFT', 'pending', false],
      ['APPV', 'approved', false],
      ['APPV', 'none', false],
    ];
    for (const [toCode, approvalStatus, expected] of cases) {
      expect(isVpTransitionBlocked(toCode, approvalStatus)).toBe(expected);
    }
  });

  it('blocks scheduling until the header carries a scheduled date', () => {
    expect(isScheduleBlocked('SCHD', undefined)).toBe(true);
    expect(isScheduleBlocked('SCHD', null)).toBe(true);
    expect(isScheduleBlocked('SCHD', '2026-08-20T00:00:00Z')).toBe(false);
    expect(isScheduleBlocked('SENT', undefined)).toBe(false);
  });
});

describe('field definitions', () => {
  it('drops the immutable amount from the edit grid but keeps everything else', () => {
    expect(PRIMARY_INFO_FIELDS.some((f) => f.key === 'amount')).toBe(true);
    expect(EDIT_FIELDS.some((f) => f.key === 'amount')).toBe(false);
    expect(EDIT_FIELDS).toHaveLength(PRIMARY_INFO_FIELDS.length - 1);
  });

  it('allows edits only at the two statuses the backend accepts a PATCH on', () => {
    expect([...VP_EDITABLE_STATUSES].sort()).toEqual(['DRFT', 'PAPV']);
  });
});

describe('validateVendorPaymentCustomFields', () => {
  const defs = [
    { id: '1', key: 'po_ref', label: 'PO Reference', type: 'text', required: true },
    { id: '2', key: 'note', label: 'Note', type: 'text', required: false },
  ] as unknown as FieldDefinition[];

  it('reports only required fields that are empty', () => {
    expect(validateVendorPaymentCustomFields(defs, { po_ref: 'PO-1' })).toEqual([]);
    expect(validateVendorPaymentCustomFields(defs, {})).toEqual([{ key: 'po_ref', label: 'PO Reference' }]);
    expect(validateVendorPaymentCustomFields(defs, { po_ref: '' })).toEqual([{ key: 'po_ref', label: 'PO Reference' }]);
    expect(validateVendorPaymentCustomFields(defs, { po_ref: null })).toEqual([{ key: 'po_ref', label: 'PO Reference' }]);
  });
});
