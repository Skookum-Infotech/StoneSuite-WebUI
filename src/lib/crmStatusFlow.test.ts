import { describe, it, expect } from 'vitest';
import {
  CRM_CONVERT_FROM_STATUS,
  CRM_PENDING_CONVERSION_FROM,
  CRM_PENDING_CONVERSION_STATUS,
  canConvertCrmRecord,
  canMarkPendingConversion,
  CUSTOMER_STATUS,
  CUSTOMER_STATUS_ACTIONS,
  CUSTOMER_USABLE_STATUS,
  customerEditNotice,
  customerStatusActions,
} from './crmStatusFlow';

interface Case {
  name: string;
  workflowKey: string;
  statusCode: string | undefined;
  gated: boolean | undefined;
  want: boolean;
}

const CONVERT_CASES: Case[] = [
  { name: 'a Qualified lead', workflowKey: 'lead', statusCode: 'LQUA', gated: false, want: true },
  { name: 'a Qualified lead with no approval overlay', workflowKey: 'lead', statusCode: 'LQUA', gated: undefined, want: true },
  { name: 'a Qualified lead awaiting approval', workflowKey: 'lead', statusCode: 'LQUA', gated: true, want: false },
  { name: 'a New lead', workflowKey: 'lead', statusCode: 'LNEW', gated: false, want: false },
  { name: 'an Unqualified lead', workflowKey: 'lead', statusCode: 'LUNQ', gated: false, want: false },
  { name: 'a lead whose status has not loaded yet', workflowKey: 'lead', statusCode: undefined, gated: false, want: false },
  { name: 'a prospect in Pending Conversion', workflowKey: 'prospect', statusCode: 'PPCV', gated: false, want: true },
  { name: 'a Pending Conversion prospect awaiting approval', workflowKey: 'prospect', statusCode: 'PPCV', gated: true, want: false },
  { name: 'a prospect still being worked', workflowKey: 'prospect', statusCode: 'PDIS', gated: false, want: false },
  { name: 'a New prospect', workflowKey: 'prospect', statusCode: 'PNEW', gated: false, want: false },
  { name: 'a Lost prospect', workflowKey: 'prospect', statusCode: 'PCLL', gated: false, want: false },
  { name: 'a prospect whose status has not loaded yet', workflowKey: 'prospect', statusCode: undefined, gated: false, want: false },
  { name: 'a customer (it has no Convert action)', workflowKey: 'customer', statusCode: 'CACT', gated: false, want: false },
];

const PROSPECT_WORKING_STATUSES = ['PDIS', 'PNEG', 'PPRP', 'PIDM', 'PPUR'];

const PENDING_CONVERSION_CASES: Case[] = [
  ...PROSPECT_WORKING_STATUSES.map((statusCode) => ({
    name: `a prospect in ${statusCode}`, workflowKey: 'prospect', statusCode, gated: false, want: true,
  })),
  { name: 'a working prospect with no approval overlay', workflowKey: 'prospect', statusCode: 'PDIS', gated: undefined, want: true },
  { name: 'a working prospect awaiting approval', workflowKey: 'prospect', statusCode: 'PDIS', gated: true, want: false },
  { name: 'a New prospect', workflowKey: 'prospect', statusCode: 'PNEW', gated: false, want: false },
  { name: 'a Lost prospect', workflowKey: 'prospect', statusCode: 'PCLL', gated: false, want: false },
  { name: 'a prospect already in Pending Conversion', workflowKey: 'prospect', statusCode: 'PPCV', gated: false, want: false },
  { name: 'a prospect whose status has not loaded yet', workflowKey: 'prospect', statusCode: undefined, gated: false, want: false },
  { name: 'a lead (only prospects have this status)', workflowKey: 'lead', statusCode: 'LQUA', gated: false, want: false },
  { name: 'a customer (only prospects have this status)', workflowKey: 'customer', statusCode: 'CACT', gated: false, want: false },
];

describe('canConvertCrmRecord', () => {
  it.each(CONVERT_CASES)('$name', ({ workflowKey, statusCode, gated, want }) => {
    expect(canConvertCrmRecord(workflowKey, statusCode, gated)).toBe(want);
  });

  it('mirrors the backend: a Lead must be Qualified and a Prospect must be Pending Conversion', () => {
    expect(CRM_CONVERT_FROM_STATUS).toEqual({ lead: 'LQUA', prospect: 'PPCV' });
  });
});

describe('canMarkPendingConversion', () => {
  it.each(PENDING_CONVERSION_CASES)('$name', ({ workflowKey, statusCode, gated, want }) => {
    expect(canMarkPendingConversion(workflowKey, statusCode, gated)).toBe(want);
  });

  it("mirrors the backend: offered from a prospect's working statuses only", () => {
    expect(CRM_PENDING_CONVERSION_STATUS).toBe('PPCV');
    expect([...CRM_PENDING_CONVERSION_FROM.prospect].sort()).toEqual([...PROSPECT_WORKING_STATUSES].sort());
  });

  it('sets the very status a prospect must be in to be converted', () => {
    expect(CRM_CONVERT_FROM_STATUS.prospect).toBe(CRM_PENDING_CONVERSION_STATUS);
  });
});

interface CustomerActionCase {
  name: string;
  statusCode: string | undefined;
  gated: boolean | undefined;
  want: string[]; // "<label> -> <status>" for each button, in order
}

const CUSTOMER_ACTION_CASES: CustomerActionCase[] = [
  { name: 'a Draft customer can only be made Active', statusCode: 'CDRF', gated: false, want: ['Make Active -> CACT'] },
  { name: 'an Active customer can go on Credit Hold or be made Inactive', statusCode: 'CACT', gated: false, want: ['Credit Hold -> CCHD', 'Make Inactive -> CINA'] },
  { name: 'a customer on Credit Hold is released back to Active or made Inactive', statusCode: 'CCHD', gated: false, want: ['Release Hold -> CACT', 'Make Inactive -> CINA'] },
  { name: 'an Inactive customer can be made Active again', statusCode: 'CINA', gated: false, want: ['Make Active -> CACT'] },
  { name: 'no approval overlay at all', statusCode: 'CACT', gated: undefined, want: ['Credit Hold -> CCHD', 'Make Inactive -> CINA'] },
  { name: 'a Draft customer awaiting approval has no buttons — approval makes it Active', statusCode: 'CDRF', gated: true, want: [] },
  { name: 'a gated customer has no buttons whatever its status', statusCode: 'CACT', gated: true, want: [] },
  { name: 'a customer whose status has not loaded yet', statusCode: undefined, gated: false, want: [] },
  { name: 'a customer left in a retired status', statusCode: 'CCLW', gated: false, want: [] },
];

describe('customerStatusActions', () => {
  it.each(CUSTOMER_ACTION_CASES)('$name', ({ statusCode, gated, want }) => {
    const got = customerStatusActions(statusCode, gated).map((a) => `${a.label} -> ${a.toStatus}`);
    expect(got).toEqual(want);
  });

  it('never moves a customer somewhere the backend flow would refuse', () => {
    // Mirrors crmStageFlows["CUST"]: Draft -> Active; Active -> Credit Hold | Inactive;
    // Credit Hold -> Active | Inactive; Inactive -> Active. Nothing goes back to Draft.
    const flow: Record<string, string[]> = {
      [CUSTOMER_STATUS.DRAFT]: [CUSTOMER_STATUS.ACTIVE],
      [CUSTOMER_STATUS.ACTIVE]: [CUSTOMER_STATUS.CREDIT_HOLD, CUSTOMER_STATUS.INACTIVE],
      [CUSTOMER_STATUS.CREDIT_HOLD]: [CUSTOMER_STATUS.ACTIVE, CUSTOMER_STATUS.INACTIVE],
      [CUSTOMER_STATUS.INACTIVE]: [CUSTOMER_STATUS.ACTIVE],
    };
    for (const [from, actions] of Object.entries(CUSTOMER_STATUS_ACTIONS)) {
      expect(actions.map((a) => a.toStatus)).toEqual(flow[from]);
    }
    expect(Object.keys(CUSTOMER_STATUS_ACTIONS).sort()).toEqual(Object.keys(flow).sort());
  });

  it('gives every button of a status its own key, so their icons and toasts differ', () => {
    for (const actions of Object.values(CUSTOMER_STATUS_ACTIONS)) {
      expect(new Set(actions.map((a) => a.key)).size).toBe(actions.length);
    }
  });

  it('treats Active as the one status a customer can be used in', () => {
    expect(CUSTOMER_USABLE_STATUS).toBe('CACT');
  });
});

describe('customerEditNotice', () => {
  it.each(['CACT', 'CINA', 'CCHD'])('warns before an edit to a customer in %s', (statusCode) => {
    expect(customerEditNotice(statusCode, false)).toMatch(/returns this customer to Draft/);
    expect(customerEditNotice(statusCode, false)).toMatch(/make it Active again/);
  });

  it('adds that approval starts again when the stage has approvers', () => {
    const notice = customerEditNotice('CACT', true);
    expect(notice).toMatch(/sends it for approval again/);
    expect(notice).not.toMatch(/make it Active again/);
  });

  it('has nothing to warn a Draft customer about', () => {
    expect(customerEditNotice('CDRF', false)).toBeNull();
    expect(customerEditNotice('CDRF', true)).toBeNull();
  });

  it('gives no warning while the status has not loaded', () => {
    expect(customerEditNotice(undefined, true)).toBeNull();
  });
});
