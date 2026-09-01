import { useQuery } from '@tanstack/react-query';
import { rbacService } from '@/services/tenantServices';
import { useAuthStore } from '@/store/useAuthStore';

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
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const isPortal = useAuthStore((s) => s.kind === 'portal');

  const { data, isLoading } = useQuery({
    // Include userId in the key so each identity gets its own cache entry.
    // Without this, a prior user's stale grants bleed into the next login.
    queryKey: ['user-permissions', userId],
    queryFn: () => rbacService.myPermissions(),
    // A portal session never fires this query — see PORTAL_GRANTS above for
    // why calling it would only produce a 403 and a spurious security-log
    // entry (portal_token_outside_portal) on every customer page load.
    enabled: isAuthenticated && Boolean(userId) && !isPortal,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

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

  return { grants, hasPermission, isLoading: isPortal ? false : isLoading, activeRoleId };
}
