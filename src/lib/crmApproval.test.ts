import { describe, it, expect } from 'vitest';
import { isCrmTransitionBlocked, CRM_ALWAYS_ALLOWED_EXIT_CODES } from './crmApproval';

describe('isCrmTransitionBlocked', () => {
  it('never blocks when not gated', () => {
    expect(isCrmTransitionBlocked(false, 'PDIS')).toBe(false);
    expect(isCrmTransitionBlocked(false, 'LUNQ')).toBe(false);
  });

  it('blocks an ordinary target while gated', () => {
    expect(isCrmTransitionBlocked(true, 'PDIS')).toBe(true);
  });

  it.each([...CRM_ALWAYS_ALLOWED_EXIT_CODES])('lets the %s exit through while gated', (code) => {
    expect(isCrmTransitionBlocked(true, code)).toBe(false);
  });

  it('blocks an unrecognized/empty target code while gated (conversion path)', () => {
    expect(isCrmTransitionBlocked(true, '')).toBe(true);
  });
});
