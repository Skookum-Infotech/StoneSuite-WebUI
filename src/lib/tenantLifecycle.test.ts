import { describe, it, expect } from 'vitest';
import { tenantActionState, isPurgeConfirmed } from './tenantLifecycle';

const NONE = { canSuspend: false, canRestore: false, canPurge: false, isProtected: false };

describe('tenantActionState', () => {
  it.each([
    ['active', { canSuspend: true, canRestore: false, canPurge: true }],
    ['suspended', { canSuspend: false, canRestore: true, canPurge: true }],
    // Applications that never reached a workspace can still be cleared out.
    ['submitted', { canSuspend: false, canRestore: false, canPurge: true }],
    ['invited', { canSuspend: false, canRestore: false, canPurge: true }],
    ['rejected', { canSuspend: false, canRestore: false, canPurge: true }],
    // A half-finished purge leaves the tenant 'deleted'; running it again resumes.
    ['deleted', { canSuspend: false, canRestore: false, canPurge: true }],
    // The backend refuses a purge while a provisioning job could race it.
    ['provisioning', { canSuspend: false, canRestore: false, canPurge: false }],
  ])('%s customer', (status, expected) => {
    expect(tenantActionState({ status, isPlatformOwner: false })).toEqual({
      ...NONE,
      ...expected,
    });
  });

  it.each(['active', 'suspended', 'deleted'])(
    'offers nothing on the platform owner workspace (%s)',
    (status) => {
      expect(tenantActionState({ status, isPlatformOwner: true })).toEqual({
        ...NONE,
        isProtected: true,
      });
    },
  );

  it('treats a missing isPlatformOwner flag (older backend) as a normal customer', () => {
    expect(tenantActionState({ status: 'active' })).toEqual({
      ...NONE,
      canSuspend: true,
      canPurge: true,
    });
  });
});

describe('isPurgeConfirmed', () => {
  it.each([
    ['acme', 'acme', true],
    ['acme', '  acme  ', true],
    ['acme', 'acme ', true],
    ['acme', 'Acme', false],
    ['acme', 'ACME', false],
    ['acme', 'acm', false],
    ['acme', 'acmee', false],
    ['acme', '', false],
    ['acme', '   ', false],
    ['', '', false],
  ])('slug %j typed %j → %s', (slug, typed, expected) => {
    expect(isPurgeConfirmed(slug, typed)).toBe(expected);
  });
});
