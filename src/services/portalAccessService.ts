import { tenantClient } from '@/api/tenantClient';
import type {
  PortalUser,
  PortalUserRosterEntry,
  PortalInviteResult,
  GrantPortalAccessPayload,
} from '@/types/portalUser';

// Staff-facing customer-portal access management. Talks to
// /api/tenant/customers/{uuid}/portal-users* (one customer's logins) and
// /api/tenant/portal-users (every login in the tenant) — see
// controllers/portal_access.go. Gated server-side on the portal_access
// resource, deliberately separate from customer:* permissions: granting one
// of these mints an external credential into the workspace.
const customerBase = (customerUuid: string) => `/tenant/customers/${customerUuid}/portal-users`;

export const portalAccessService = {
  listForCustomer: (customerUuid: string): Promise<PortalUser[]> =>
    tenantClient
      .get<{ success: boolean; portalUsers: PortalUser[] }>(customerBase(customerUuid))
      .then((r) => r.data.portalUsers ?? []),

  grant: (customerUuid: string, payload: GrantPortalAccessPayload): Promise<PortalInviteResult> =>
    tenantClient
      .post<{ success: boolean } & PortalInviteResult>(customerBase(customerUuid), payload)
      .then((r) => ({ portalUser: r.data.portalUser, emailSent: r.data.emailSent, emailError: r.data.emailError })),

  // Mints a new invite token, so a previously leaked or forwarded link stops
  // working — the same call doubles as "resend" and "invalidate".
  resendInvite: (customerUuid: string, id: string): Promise<PortalInviteResult> =>
    tenantClient
      .post<{ success: boolean } & PortalInviteResult>(`${customerBase(customerUuid)}/${id}/resend`, {})
      .then((r) => ({ portalUser: r.data.portalUser, emailSent: r.data.emailSent, emailError: r.data.emailError })),

  // Reversible — see resume(). Kills the customer's live session immediately.
  suspend: (customerUuid: string, id: string): Promise<void> =>
    tenantClient.post(`${customerBase(customerUuid)}/${id}/suspend`, {}).then(() => undefined),

  resume: (customerUuid: string, id: string): Promise<void> =>
    tenantClient.post(`${customerBase(customerUuid)}/${id}/resume`, {}).then(() => undefined),

  // Permanent withdrawal. Grant again to restore access (re-checks eligibility).
  revoke: (customerUuid: string, id: string): Promise<void> =>
    tenantClient.delete(`${customerBase(customerUuid)}/${id}`).then(() => undefined),

  // Tenant-wide roster across every customer — distinct from listForCustomer,
  // which scopes to one. Not paginated: a workspace's portal-user count is
  // small enough that the server returns everything in one response.
  listForTenant: (): Promise<PortalUserRosterEntry[]> =>
    tenantClient
      .get<{ success: boolean; portalUsers: PortalUserRosterEntry[] }>('/tenant/portal-users')
      .then((r) => r.data.portalUsers ?? []),
};
