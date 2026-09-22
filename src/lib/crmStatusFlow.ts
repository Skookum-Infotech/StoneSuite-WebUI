import type { StatusInfo } from '@/types/tenant';

// CRM (Lead/Prospect/Customer) status-flow helpers shared by the detail pages.
// Mirrors crmConvertRules, the prospect's working statuses (prospectWorking) and the
// customer status flow in the backend's crmstore/relational_status.go — keep them
// in sync. Which moves a record's status dropdown offers is NOT mirrored here: that
// comes from the server per record (GET .../transitions). The exceptions are the
// statuses the dropdown never lists because a button sets them instead — a
// prospect's Pending Conversion and a customer's Active / Inactive / Credit Hold —
// so when to offer those buttons has to be known here.

/** CRM status code (lkp_crm_status.crm_status_code) a record of each workflow
 *  must be in before it can be converted onward: a Lead must be Qualified, a
 *  Prospect must be Pending Conversion. A workflow with no entry converts from
 *  any status. */
export const CRM_CONVERT_FROM_STATUS: Record<string, string> = { lead: 'LQUA', prospect: 'PPCV' };

/** The status the Pending Conversion header button sets. */
export const CRM_PENDING_CONVERSION_STATUS = 'PPCV';

/** Codes of the three Lead statuses relevant to its status buttons
 *  (lkp_crm_status.crm_status_code). */
export const LEAD_STATUS = {
  NEW: 'LNEW',
  QUALIFIED: 'LQUA',
  UNQUALIFIED: 'LUNQ',
} as const;

/** Identifies a Lead status button, for its icon and its mutation's pending check. */
export type LeadStatusActionKey = 'qualify' | 'unqualify';

/** A Lead header status button: the status it sets, its label, and the toast
 *  shown once it has. */
export interface LeadStatusAction {
  key: LeadStatusActionKey;
  toStatus: string;
  label: string;
  success: string;
}

const MARK_QUALIFIED: LeadStatusAction = {
  key: 'qualify', toStatus: LEAD_STATUS.QUALIFIED, label: 'Mark Qualified', success: 'Lead marked Qualified.',
};
const MARK_UNQUALIFIED: LeadStatusAction = {
  key: 'unqualify', toStatus: LEAD_STATUS.UNQUALIFIED, label: 'Mark Unqualified', success: 'Lead marked Unqualified.',
};

/** The status buttons to show for a Lead — only while it is New. Qualified and
 *  Unqualified are both terminal for the Lead workflow itself: a Qualified
 *  lead moves on via the header's Convert to Prospect button instead of
 *  another status button. Mirrors CUSTOMER_STATUS_ACTIONS below. */
export function leadStatusActions(statusCode: string | undefined): readonly LeadStatusAction[] {
  return statusCode === LEAD_STATUS.NEW ? [MARK_QUALIFIED, MARK_UNQUALIFIED] : [];
}

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

/** Codes of the four customer statuses (lkp_crm_status.crm_status_code). */
export const CUSTOMER_STATUS = {
  DRAFT: 'CDRF',
  ACTIVE: 'CACT',
  INACTIVE: 'CINA',
  CREDIT_HOLD: 'CCHD',
} as const;

/** The one customer status a customer can be used on other records in — the
 *  Sales pickers list only these, and the backend refuses to create a document
 *  for any other (workflow/customer_usable.go). */
export const CUSTOMER_USABLE_STATUS = CUSTOMER_STATUS.ACTIVE;

/** Identifies a customer status button — Make Active and Release Hold both set
 *  Active, so the target status alone can't tell them apart (the button's icon is
 *  chosen by this). */
export type CustomerStatusActionKey = 'activate' | 'inactivate' | 'hold' | 'release';

/** A Quick Action button on a customer: the status it sets, its label, and the
 *  toast shown once it has. */
export interface CustomerStatusAction {
  key: CustomerStatusActionKey;
  toStatus: string;
  label: string;
  success: string;
}

const MAKE_ACTIVE: CustomerStatusAction = {
  key: 'activate', toStatus: CUSTOMER_STATUS.ACTIVE, label: 'Make Active', success: 'Customer is now Active.',
};
const MAKE_INACTIVE: CustomerStatusAction = {
  key: 'inactivate', toStatus: CUSTOMER_STATUS.INACTIVE, label: 'Make Inactive', success: 'Customer is now Inactive.',
};
const CREDIT_HOLD: CustomerStatusAction = {
  key: 'hold', toStatus: CUSTOMER_STATUS.CREDIT_HOLD, label: 'Credit Hold', success: 'Customer put on Credit Hold.',
};
const RELEASE_HOLD: CustomerStatusAction = {
  key: 'release', toStatus: CUSTOMER_STATUS.ACTIVE, label: 'Release Hold', success: 'Credit Hold released. Customer is Active.',
};

/** The buttons offered for a customer in each status. Mirrors the customer flow
 *  (crmStageFlows["CUST"]) in the backend's crmstore/relational_status.go: Draft
 *  is made Active (by hand, or by approval), an Active customer goes on Credit
 *  Hold or is made Inactive, and either can be made Active again. The status
 *  dropdown lists none of these — the backend never offers a customer's statuses
 *  from it — so the buttons are the only way to change one. */
export const CUSTOMER_STATUS_ACTIONS: Record<string, readonly CustomerStatusAction[]> = {
  [CUSTOMER_STATUS.DRAFT]: [MAKE_ACTIVE],
  [CUSTOMER_STATUS.ACTIVE]: [CREDIT_HOLD, MAKE_INACTIVE],
  [CUSTOMER_STATUS.CREDIT_HOLD]: [RELEASE_HOLD, MAKE_INACTIVE],
  [CUSTOMER_STATUS.INACTIVE]: [MAKE_ACTIVE],
};

/** The status buttons to show for a customer. None while it is awaiting or
 *  rejected from approval (`record.approval.gated`): the backend refuses any
 *  status change then — its approvers approving it is what makes it Active — so
 *  the buttons are hidden instead of firing and failing. */
export function customerStatusActions(
  statusCode: string | undefined,
  gated: boolean | undefined,
): readonly CustomerStatusAction[] {
  if (gated || statusCode === undefined) return [];
  return CUSTOMER_STATUS_ACTIONS[statusCode] ?? [];
}

/** What to warn a user about before they save an edit to a customer, or null when
 *  there is nothing to warn about. The backend puts an edited customer back in
 *  Draft (crmEditedStatusCode) — and sends it for approval again when its stage
 *  has approvers — so an Active, Inactive or Credit Hold customer stops being
 *  usable on other records the moment the edit is saved. A customer already in
 *  Draft has nothing to lose, and one whose status hasn't loaded yet gets no
 *  warning rather than a wrong one. */
/** Whether the customer record at `currentStateId` is already Active — used by
 *  the Add Customer page's duplicate-name check (AddCustomerPage.tsx) to tell
 *  an already-usable duplicate from one that would need reactivating first. */
export function customerRecordIsUsable(currentStateId: string, statuses: StatusInfo[]): boolean {
  return statuses.find((s) => s.stateId === currentStateId)?.stateKey === CUSTOMER_USABLE_STATUS;
}

/** The stateId to pass to `crmService.transitionRecord` to make a customer
 *  Active — resolved from the workflow's status catalog since `transitionRecord`
 *  takes a stateId, not the `CACT` status code. */
export function customerActiveStateId(statuses: StatusInfo[]): string | undefined {
  return statuses.find((s) => s.stateKey === CUSTOMER_STATUS.ACTIVE)?.stateId;
}

export function customerEditNotice(
  statusCode: string | undefined,
  requiresApproval: boolean,
): string | null {
  if (statusCode === undefined || statusCode === CUSTOMER_STATUS.DRAFT) return null;
  return requiresApproval
    ? "Saving changes returns this customer to Draft and sends it for approval again. It can't be used on other records until it is approved."
    : "Saving changes returns this customer to Draft. It can't be used on other records until you make it Active again.";
}
