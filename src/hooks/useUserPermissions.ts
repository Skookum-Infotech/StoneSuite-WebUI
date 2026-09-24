import { useAuthStore } from '@/store/useAuthStore';
import { useMyPermissionsQuery } from '@/hooks/useMyPermissionsQuery';
import { isSuperAdminGrants } from '@/lib/dashboardWidgets';

// A customer-portal identity has no `users` row and so no RBAC grants at all
// (see CLAUDE.md's merged-login design) — rbacService.myPermissions() lives
// under /api/tenant/*, which a portal-kind token is structurally confined
// away from (middleware.RequireAuth) and would 403. This is the one
// hardcoded allowlist for that session kind: read-only access to the four
// document types exposed at /api/portal/*, nothing else. Every other
// resource/action (including update/delete/create on these same four) stays
// denied, matching exactly what the backend actually lets a portal token
// reach — this list exists to keep the UI in sync with that boundary, not to
// define it.
const PORTAL_GRANTS: ReadonlySet<string> = new Set([
  'sales_order:read',
  'invoice:read',
  'payment:read',
  'refund:read',
]);

export function useUserPermissions() {
  const isPortal = useAuthStore((s) => s.kind === 'portal');

  // Shared with useCurrentUserRoles — see useMyPermissionsQuery for the key,
  // the portal-session gate, and the caching.
  const { data, isLoading } = useMyPermissionsQuery();

  const grants = data?.grants ?? [];
  // '' means no active-role restriction is set server-side (all assigned
  // roles' grants apply) — distinct from "no roles assigned".
  const activeRoleId = data?.activeRoleId ?? '';

  // Handles both exact matches and wildcard grants (super_admin has resource="*", action="*").
  function hasPermission(resource: string, action: string): boolean {
    if (isPortal) return PORTAL_GRANTS.has(`${resource}:${action}`);
    return grants.some(
      (g) =>
        (g.resource === resource || g.resource === '*') &&
        (g.action === action || g.action === '*'),
    );
  }

  // The literal `*:*` grant is reserved for the seeded super_admin role — the
  // same test the backend's authz.IsSuperAdmin applies. False until grants load
  // (and always for a portal session) so an admin-only control never flashes up
  // for a non-admin; unlike the optimistic `can*` checks, this one fails closed.
  const isSuperAdmin = !isPortal && isSuperAdminGrants(grants);

  return { grants, hasPermission, isSuperAdmin, isLoading: isPortal ? false : isLoading, activeRoleId };
}
