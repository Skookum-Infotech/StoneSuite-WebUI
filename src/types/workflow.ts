// End-to-end workflow block returned on a record's detail response. Contract:
// BACKEND_SPEC_workflow_links.md at the repo root.

export type WorkflowStageKey =
  | 'quote' | 'salesOrder' | 'fabrication' | 'invoice' | 'payment'
  | 'requisition' | 'purchaseOrder' | 'receiving' | 'vendorBill' | 'vendorPayment';

export interface WorkflowRecordRef {
  id: string;
  number: string;
  statusCode: string;
  status: string;
}

export interface WorkflowStage {
  key: WorkflowStageKey;
  /** Empty means nothing has been created at this stage yet. */
  records: WorkflowRecordRef[];
  /** True when the server left out records the caller may not see. */
  hidden?: boolean;
}

export interface WorkflowBlock {
  stages: WorkflowStage[];
}
