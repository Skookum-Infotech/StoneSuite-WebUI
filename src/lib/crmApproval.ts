// CRM (Lead/Prospect/Customer) approval-gate helpers shared by StatusDropdown,
// CrmRecordTable, and the three detail/edit pages. Mirrors
// crmAlwaysAllowedExitCodes / checkTransitionGate in the backend's
// crmstore/relational_approval.go — keep the two in sync.

/** CRM status codes (lkp_crm_status.crm_status_code) a gated record may still
 *  move to without approval — marking a dead deal dead is a way OUT of the
 *  approval process, not a way past it. Lead Unqualified and Prospect Lost — a
 *  customer has none: while it awaits approval it is a Draft, and its approvers
 *  approving or rejecting it are the only ways on. */
export const CRM_ALWAYS_ALLOWED_EXIT_CODES = new Set(['LUNQ', 'PCLL']);

/** Whether a transition to targetStatusCode is blocked while the record's
 *  stage is gated (awaiting or rejected from approval) — used to disable
 *  status-picker options instead of letting the click 409. */
export function isCrmTransitionBlocked(gated: boolean, targetStatusCode: string): boolean {
  return gated && !CRM_ALWAYS_ALLOWED_EXIT_CODES.has(targetStatusCode);
}
