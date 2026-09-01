// Customer-portal login types — the staff-facing side of who from outside can
// sign in to this workspace. Mirrors StoneSuite-Backend's portal.User plus the
// invitation state portalUserView() attaches
// (controllers/portal_access.go), served from
// /api/tenant/customers/{uuid}/portal-users* (per customer) and
// /api/tenant/portal-users (tenant-wide roster).

// 'active' may sign in. 'suspended' is a reversible pause — resuming it does
// not require the owning customer record to be re-approved. 'revoked' is
// permanent; re-granting access goes through the same eligibility check as a
// first-time grant.
export type PortalUserStatus = 'active' | 'suspended' | 'revoked';

export type PortalInviteStatus = 'none' | 'pending' | 'expired' | 'accepted' | 'revoked';

export interface PortalUser {
  id: string;
  email: string;
  fullName: string;
  status: PortalUserStatus;
  createdAt: string;
  suspendedAt?: string;
  revokedAt?: string;
  inviteStatus: PortalInviteStatus;
  inviteExpiresAt?: string;
}

// One row of the tenant-wide roster (GET /api/tenant/portal-users) — a
// PortalUser plus which customer it belongs to and who granted it, so staff
// can see every external login in the workspace without opening each
// customer record individually.
export interface PortalUserRosterEntry extends PortalUser {
  customerUuid: string;
  customerName: string;
  grantedByName: string;
}

export interface GrantPortalAccessPayload {
  email: string;
  fullName: string;
}
