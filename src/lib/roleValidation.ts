import type { Role } from '@/types/tenant';

/**
 * A role holding the '*'/'*' wildcard grant (the seeded Super Admin) has
 * exactly one permission row, but it means "every resource and action" —
 * callers must never surface `permissions.length` as a literal count for it.
 */
export function hasWildcardGrant(role: Pick<Role, 'permissions'>): boolean {
  return role.permissions.some((p) => p.resource === '*');
}

/**
 * True when `name` (trimmed, case-insensitive) matches an existing role's
 * name. Pass the role being edited as `excludeId` so it can keep its own
 * unchanged name without tripping the check.
 */
export function isDuplicateRoleName(
  name: string,
  roles: Pick<Role, 'id' | 'name'>[],
  excludeId?: string,
): boolean {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return false;
  return roles.some((r) => r.id !== excludeId && r.name.trim().toLowerCase() === trimmed);
}
