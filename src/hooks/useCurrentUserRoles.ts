import { useMyPermissionsQuery } from '@/hooks/useMyPermissionsQuery';
import { useAuthStore } from '@/store/useAuthStore';
import type { UserRole } from '@/types/auth';

// Module-level so the result keeps a stable identity across renders when empty.
const EMPTY_ROLES: readonly UserRole[] = [];

// The signed-in user's assigned roles, live. The server's list is authoritative
// once loaded — including an empty one after a removal — so a role assigned or
// removed mid-session shows up as soon as the user-permissions query is
// invalidated (see invalidateUserRoleQueries), with no re-login. The login-time
// copy in the auth store only covers first paint and a backend that predates
// the field, and is never the source of truth once the response is in.
export function useCurrentUserRoles(): readonly UserRole[] {
  const { data } = useMyPermissionsQuery();
  const loginSnapshot = useAuthStore((s) => s.user?.roles);
  return data?.roles ?? loginSnapshot ?? EMPTY_ROLES;
}
