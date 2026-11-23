import type { QueryClient } from '@tanstack/react-query';

// Query-key roots that depend on which roles a user holds. Shared between the
// readers (useUserPermissions, the Users page) and the role assign/remove
// mutations so the two sides cannot drift apart: React Query matches keys by
// array prefix, so a mutation that invalidates one root does not touch a
// differently-named one that happens to hold related data.
export const USERS_QUERY_KEY = 'users';
export const USER_PERMISSIONS_QUERY_KEY = 'user-permissions';

// Call from the onSuccess of any mutation that assigns or removes a role.
// The target may be the signed-in user, and their roles + grants come from the
// user-permissions query (header menu, Account Settings, every permission-gated
// control) — so refresh that alongside the admin-facing Users list. The prefix
// key covers the per-user ['user-permissions', userId] entry without needing
// the id here.
export function invalidateUserRoleQueries(qc: QueryClient): Promise<void> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: [USERS_QUERY_KEY] }),
    qc.invalidateQueries({ queryKey: [USER_PERMISSIONS_QUERY_KEY] }),
  ]).then(() => undefined);
}
