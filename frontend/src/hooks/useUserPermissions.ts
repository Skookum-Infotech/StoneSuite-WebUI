import { useQuery } from '@tanstack/react-query';
import { rbacService } from '@/services/tenantServices';
import { useAuthStore } from '@/store/useAuthStore';

export function useUserPermissions() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);

  const { data: grants = [], isLoading } = useQuery({
    // Include userId in the key so each identity gets its own cache entry.
    // Without this, a prior user's stale grants bleed into the next login.
    queryKey: ['user-permissions', userId],
    queryFn: () => rbacService.myPermissions(),
    enabled: isAuthenticated && Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Handles both exact matches and wildcard grants (super_admin has resource="*", action="*").
  function hasPermission(resource: string, action: string): boolean {
    return grants.some(
      (g) =>
        (g.resource === resource || g.resource === '*') &&
        (g.action === action || g.action === '*'),
    );
  }

  return { grants, hasPermission, isLoading };
}
