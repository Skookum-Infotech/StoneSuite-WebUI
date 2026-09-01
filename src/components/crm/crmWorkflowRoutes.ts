// Base list-page routes for each CRM workflow, keyed by workflow key. Used to
// navigate to a record's new page after a transition converts it to a
// different workflow (e.g. Lead -> Prospect creates a Prospect record) —
// shared by CrmRecordTable and the per-workflow Detail pages.
export const CRM_WORKFLOW_ROUTES: Record<string, string> = {
  lead: '/crm/lead',
  prospect: '/crm/prospect',
  customer: '/crm/customer',
};
