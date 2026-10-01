// Customer-portal login types — the staff-facing side of who from outside can
// sign in to this workspace. Mirrors StoneSuite-Backend's portal.User plus the
// invitation state portalUserView() attaches
// (controllers/portal_access.go), served from
// /api/tenant/customers/{uuid}/portal-users* (per customer) and
// /api/tenant/portal-users (tenant-wide roster).

import type { EmailStatusFields } from '@/types/emailStatus';

// 'active' may sign in. 'suspended' is a reversible pause — resuming it does
// not require the owning customer record to be re-approved. 'revoked' is
// permanent; re-granting access goes through the same eligibility check as a
// first-time grant.
export type PortalUserStatus = 'active' | 'suspended' | 'revoked';

export type PortalInviteStatus = 'none' | 'pending' | 'expired' | 'accepted' | 'revoked';

export interface PortalUser extends EmailStatusFields {
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

// What granting access or resending an invite returns: the login, plus what
// really happened to the invitation email. The backend sends mail through
// stonesuite-notify asynchronously and waits for the first delivery attempt
// before answering, so emailSent === false is a real failure, not a guess.
// Both fields are absent when no invite was sent (the customer already has a
// password), so only an explicit `false` means "the email did not go".
export interface PortalInviteResult {
  portalUser: PortalUser;
  emailSent?: boolean;
  // Client-safe explanation, present only when emailSent is false.
  emailError?: string;
}
