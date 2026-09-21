import { describe, it, expect } from 'vitest';
import { CRM_CONVERT_FROM_STATUS, canConvertCrmRecord } from './crmStatusFlow';

interface Case {
  name: string;
  workflowKey: string;
  statusCode: string | undefined;
  gated: boolean | undefined;
  want: boolean;
}

const CASES: Case[] = [
  { name: 'a Qualified lead', workflowKey: 'lead', statusCode: 'LQUA', gated: false, want: true },
  { name: 'a Qualified lead with no approval overlay', workflowKey: 'lead', statusCode: 'LQUA', gated: undefined, want: true },
  { name: 'a Qualified lead awaiting approval', workflowKey: 'lead', statusCode: 'LQUA', gated: true, want: false },
  { name: 'a New lead', workflowKey: 'lead', statusCode: 'LNEW', gated: false, want: false },
  { name: 'an Unqualified lead', workflowKey: 'lead', statusCode: 'LUNQ', gated: false, want: false },
  { name: 'a lead whose status has not loaded yet', workflowKey: 'lead', statusCode: undefined, gated: false, want: false },
  { name: 'a prospect (it has no Convert action)', workflowKey: 'prospect', statusCode: 'PDIS', gated: false, want: false },
  { name: 'a customer (it has no Convert action)', workflowKey: 'customer', statusCode: 'CCLW', gated: false, want: false },
];

describe('canConvertCrmRecord', () => {
  it.each(CASES)('$name', ({ workflowKey, statusCode, gated, want }) => {
    expect(canConvertCrmRecord(workflowKey, statusCode, gated)).toBe(want);
  });

  it('mirrors the backend: only a Lead is constrained, and it must be Qualified', () => {
    expect(CRM_CONVERT_FROM_STATUS).toEqual({ lead: 'LQUA' });
  });
});
