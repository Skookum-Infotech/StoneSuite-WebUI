// Wire + view types for the Approvals inbox (APR-1):
//   GET /api/tenant/approvals/inbox?scope=&module=&cursor=&limit=
// The server filters the list to what the caller may act on (everything pending
// for a super admin on scope=all), so nothing here is scope-filtered client-side.

/** `mine` = items awaiting the caller; `all` = every pending item (super admin only). */
export type ApprovalInboxScope = 'mine' | 'all';

export interface ApprovalInboxItem {
  /** Module key, e.g. `invoice` -- matches `ApprovalInboxModule.module`. */
  module: string;
  /** Human module label, e.g. "Invoice". */
  label: string;
  /** Record number, e.g. "INV-1". */
  number: string;
  /** Route segments for the detail page -- feed to recordRoute(domain, routeModule, recordUuid). */
  domain: string;
  routeModule: string;
  recordUuid: string;
  partyName?: string;
  amount?: number;
  currency?: string;
  ownerName?: string;
  /** When the record entered its approval gate (ISO timestamp). */
  waitingSince: string;
  approvedCount: number;
  requiredApprovals: number;
  /** False => the caller sees the item (scope=all) but cannot sign it off. */
  canApprove: boolean;
}

export interface ApprovalInboxModule {
  module: string;
  label: string;
  count: number;
}

export interface ApprovalInboxPage {
  items: ApprovalInboxItem[];
  modules: ApprovalInboxModule[];
  /** Total pending across every module (the "All" chip and the sidebar badge). */
  total: number;
  /** True when the caller is a configured approver on at least one workflow. */
  isApprover: boolean;
  nextCursor: string;
}

export interface ApprovalInboxParams {
  scope: ApprovalInboxScope;
  module?: string;
  cursor?: string;
  limit?: number;
}
