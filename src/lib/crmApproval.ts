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

/** CRM workflows that can gate a stage behind approval, in display order. */
export const CRM_APPROVAL_WORKFLOWS: readonly { key: string; label: string }[] = [
  { key: 'lead', label: 'Lead' },
  { key: 'prospect', label: 'Prospect' },
  { key: 'customer', label: 'Customer' },
];

/** The CRM workflows whose pending approvals the caller may see: read grant
 *  and workflow enabled. The server still scopes each response. */
export function readableCrmApprovalWorkflows(
  hasPermission: (resource: string, action: string) => boolean,
  isWorkflowEnabled: (key: string) => boolean,
): { key: string; label: string }[] {
  return CRM_APPROVAL_WORKFLOWS.filter((w) => hasPermission(w.key, 'read') && isWorkflowEnabled(w.key));
}

/** Display title for a CRM record row: its customer name, else its number. */
export function crmRecordTitle(record: {
  recordNumber?: string;
  coreFields: Record<string, unknown>;
}): string {
  const name = record.coreFields.customer_name;
  if (typeof name === 'string' && name.trim() !== '') return name;
  return record.recordNumber ?? 'Untitled record';
}

/** Whether a transition to targetStatusCode is blocked while the record's
 *  stage is gated (awaiting or rejected from approval) — used to disable
 *  status-picker options instead of letting the click 409. */
export function isCrmTransitionBlocked(gated: boolean, targetStatusCode: string): boolean {
  return gated && !CRM_ALWAYS_ALLOWED_EXIT_CODES.has(targetStatusCode);
}
