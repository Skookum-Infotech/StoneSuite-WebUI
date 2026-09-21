// CRM (Lead/Prospect/Customer) status-flow helpers shared by the detail pages.
// Mirrors crmConvertFromStatus in the backend's crmstore/relational_status.go —
// keep the two in sync. Which moves a record's status dropdown offers is NOT
// mirrored here: that comes from the server per record (GET .../transitions).

/** CRM status code (lkp_crm_status.crm_status_code) a record of each workflow
 *  must be in before it can be converted onward. Only a Lead is constrained:
 *  it must be Qualified. A workflow with no entry converts from any status. */
export const CRM_CONVERT_FROM_STATUS: Record<string, string> = { lead: 'LQUA' };

/** Whether to offer the Convert action for a record: it is in the status its
 *  workflow requires, and not awaiting or rejected from approval
 *  (`record.approval.gated`) — the backend refuses a gated conversion with a
 *  409, so the button is hidden instead of firing and failing. */
export function canConvertCrmRecord(
  workflowKey: string,
  statusCode: string | undefined,
  gated: boolean | undefined,
): boolean {
  const required = CRM_CONVERT_FROM_STATUS[workflowKey];
  return required !== undefined && statusCode === required && !gated;
}
