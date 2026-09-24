import { useQuery } from '@tanstack/react-query';
import { rbacService } from '@/services/tenantServices';
import { useAuthStore } from '@/store/useAuthStore';
import { USER_PERMISSIONS_QUERY_KEY } from '@/lib/userRoleQueries';

// The one place GET /api/tenant/users/me/permissions is queried. useUserPermissions
// (grants) and useCurrentUserRoles (roles) both read it, so React Query serves
// them from a single cached request and one invalidation refreshes both.
export function useMyPermissionsQuery() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const isPortal = useAuthStore((s) => s.kind === 'portal');

  return useQuery({
    // Include userId in the key so each identity gets its own cache entry.
    // Without this, a prior user's stale grants bleed into the next login.
    queryKey: [USER_PERMISSIONS_QUERY_KEY, userId],
    queryFn: () => rbacService.myPermissions(),
    // A portal session never fires this query — a customer-portal identity has
    // no `users` row, and this endpoint lives under /api/tenant/*, which a
    // portal-kind token is structurally confined away from (RequireAuth), so
    // calling it would only produce a 403 and a spurious security-log entry
    // (portal_token_outside_portal) on every customer page load.
    enabled: isAuthenticated && Boolean(userId) && !isPortal,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
