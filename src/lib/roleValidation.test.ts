import { describe, it, expect } from 'vitest';
import { hasWildcardGrant, isDuplicateRoleName } from './roleValidation';

describe('hasWildcardGrant', () => {
  it('is true for a role holding the */* wildcard grant', () => {
    expect(hasWildcardGrant({ permissions: [{ resource: '*', action: '*', scope: 'all' }] })).toBe(true);
  });

  it('is false for a role with only concrete resource grants', () => {
    expect(
      hasWildcardGrant({
        permissions: [
          { resource: 'lead', action: 'read', scope: 'all' },
          { resource: 'lead', action: 'create', scope: 'own' },
        ],
      }),
    ).toBe(false);
  });

  it('is false for a role with no permissions', () => {
    expect(hasWildcardGrant({ permissions: [] })).toBe(false);
  });
});

function role(id: string, name: string) {
  return { id, name };
}

describe('isDuplicateRoleName', () => {
  const roles = [role('1', 'Sales Rep'), role('2', 'Warehouse Lead')];

  it('is false when no role has that name', () => {
    expect(isDuplicateRoleName('Ops Manager', roles)).toBe(false);
  });

  it('is true for an exact match', () => {
    expect(isDuplicateRoleName('Sales Rep', roles)).toBe(true);
  });

  it.each(['sales rep', 'SALES REP', '  Sales Rep  '])('matches case- and whitespace-insensitively: %p', (candidate) => {
    expect(isDuplicateRoleName(candidate, roles)).toBe(true);
  });

  it('excludes the role being edited from the check', () => {
    expect(isDuplicateRoleName('Sales Rep', roles, '1')).toBe(false);
  });

  it('still catches a collision with a different role when editing', () => {
    expect(isDuplicateRoleName('Warehouse Lead', roles, '1')).toBe(true);
  });

  it.each(['', '   '])('is false for a blank name: %p', (candidate) => {
    expect(isDuplicateRoleName(candidate, roles)).toBe(false);
  });
});
