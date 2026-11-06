import { describe, it, expect } from 'vitest';
import { ageTone, approvalsHref, formatInboxAmount, signOffLabel, waitingDays, waitingLabel } from './approvalInbox';

const NOW = new Date('2026-11-10T12:00:00Z');

describe('approvalInbox helpers', () => {
  it.each([
    ['2026-11-10T00:00:00Z', 0],
    ['2026-11-09T11:00:00Z', 1],
    ['2026-11-05T12:00:00Z', 5],
    ['2026-11-11T12:00:00Z', 0], // future (clock skew)
    ['garbage', 0],
  ])('waitingDays(%s) = %i', (since, days) => {
    expect(waitingDays(since, NOW)).toBe(days);
  });

  it.each([
    [0, 'neutral'], [1, 'neutral'], [2, 'amber'], [4, 'amber'], [5, 'red'], [30, 'red'],
  ] as const)('ageTone(%i) = %s', (days, tone) => {
    expect(ageTone(days)).toBe(tone);
  });

  it.each([
    [0, 'Waiting today'], [1, 'Waiting 1 day'], [5, 'Waiting 5 days'],
  ])('waitingLabel(%i) = %s', (days, label) => {
    expect(waitingLabel(days)).toBe(label);
  });

  it('formats sign-off progress', () => {
    expect(signOffLabel({ approvedCount: 1, requiredApprovals: 2 })).toBe('1 of 2 approved');
  });

  it('formats amounts and omits absent ones', () => {
    expect(formatInboxAmount(1234.5, 'USD')).toBe('$1,234.50');
    expect(formatInboxAmount(10, 'NOPE')).toBe('$10.00');
    expect(formatInboxAmount(undefined)).toBeNull();
  });

  it('builds the tile drill-through', () => {
    expect(approvalsHref(false)).toBe('/approvals');
    expect(approvalsHref(true)).toBe('/approvals?scope=all');
  });
});
