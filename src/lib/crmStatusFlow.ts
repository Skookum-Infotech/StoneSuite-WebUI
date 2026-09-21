// CRM (Lead/Prospect/Customer) status-flow helpers shared by the detail pages.
// Mirrors crmConvertRules and the prospect's working statuses (prospectWorking)
// in the backend's crmstore/relational_status.go — keep them in sync. Which moves
// a record's status dropdown offers is NOT mirrored here: that comes from the
// server per record (GET .../transitions). The one exception is Pending
// Conversion, which the dropdown never lists (it has its own header button), so
// when to offer that button has to be known here.

/** CRM status code (lkp_crm_status.crm_status_code) a record of each workflow
 *  must be in before it can be converted onward: a Lead must be Qualified, a
 *  Prospect must be Pending Conversion. A workflow with no entry converts from
 *  any status. */
export const CRM_CONVERT_FROM_STATUS: Record<string, string> = { lead: 'LQUA', prospect: 'PPCV' };

/** The status the Pending Conversion header button sets. */
export const CRM_PENDING_CONVERSION_STATUS = 'PPCV';

/** Statuses a record of each workflow can be marked Pending Conversion from: a
 *  prospect's working statuses (In Discussion, In Negotiation, Proposal Sent,
 *  Decision Pending, Contacted) — not New, not Lost. */
export const CRM_PENDING_CONVERSION_FROM: Record<string, ReadonlySet<string>> = {
  prospect: new Set(['PDIS', 'PNEG', 'PPRP', 'PIDM', 'PPUR']),
};

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

/** Whether to offer the Pending Conversion button: the record is in one of its
 *  workflow's working statuses, and not awaiting or rejected from approval — a
 *  gated record may only move to Lost, so the button is hidden instead of
 *  firing and failing. */
export function canMarkPendingConversion(
  workflowKey: string,
  statusCode: string | undefined,
  gated: boolean | undefined,
): boolean {
  return statusCode !== undefined && !gated && (CRM_PENDING_CONVERSION_FROM[workflowKey]?.has(statusCode) ?? false);
}
