import {
  buildProgressSteps,
  OFF_PATH_STATUS_CODES,
  PROGRESS_PATHS,
  PROGRESS_STATUS_ALIASES,
  type ProgressModule,
  type ProgressStep,
} from '@/lib/orderProgress';
import { RECORD_PROGRESS_CONFIG } from '@/lib/recordProgressConfig';
import type { WorkflowBlock, WorkflowRecordRef, WorkflowStageKey } from '@/types/workflow';

export type WorkflowStageState = 'done' | 'here' | 'progress' | 'upcoming' | 'void';

interface StageDef {
  key: WorkflowStageKey;
  label: string;
  /** The module whose status path this stage's hover panel shows. */
  module: ProgressModule;
  /** Detail-page route prefix; the record id is appended. */
  route: string;
}

export const SALES_FLOW: StageDef[] = [
  { key: 'quote', label: 'Quote', module: 'quote', route: '/sales/quote' },
  { key: 'salesOrder', label: 'Sales order', module: 'salesOrder', route: '/sales/sales_order' },
  { key: 'fabrication', label: 'Fabrication', module: 'fabrication', route: '/sales/installation' },
  { key: 'invoice', label: 'Invoice', module: 'invoice', route: '/sales/invoice' },
  { key: 'payment', label: 'Payment', module: 'payment', route: '/sales/payment' },
];

export const PURCHASE_FLOW: StageDef[] = [
  { key: 'requisition', label: 'Requisition', module: 'requisition', route: '/purchases/requisition' },
  { key: 'purchaseOrder', label: 'Purchase order', module: 'purchaseOrder', route: '/purchases/purchase_order' },
  { key: 'receiving', label: 'Receiving', module: 'itemReceipt', route: '/purchases/item_receipt' },
  { key: 'vendorBill', label: 'Vendor bill', module: 'vendorBill', route: '/purchases/vendor_bill' },
  { key: 'vendorPayment', label: 'Payment', module: 'vendorPayment', route: '/purchases/vendor_payment' },
];

/** Which stage the page's own record sits on, and which flow it belongs to.
 *  Documents outside both flows (estimate, refund, credit memo, vendor credit,
 *  expense) are absent: they keep the plain per-document progress list. */
export const MODULE_STAGE: Partial<Record<ProgressModule, { flow: StageDef[]; key: WorkflowStageKey }>> = {
  quote: { flow: SALES_FLOW, key: 'quote' },
  salesOrder: { flow: SALES_FLOW, key: 'salesOrder' },
  fabrication: { flow: SALES_FLOW, key: 'fabrication' },
  invoice: { flow: SALES_FLOW, key: 'invoice' },
  payment: { flow: SALES_FLOW, key: 'payment' },
  requisition: { flow: PURCHASE_FLOW, key: 'requisition' },
  purchaseOrder: { flow: PURCHASE_FLOW, key: 'purchaseOrder' },
  itemReceipt: { flow: PURCHASE_FLOW, key: 'receiving' },
  vendorBill: { flow: PURCHASE_FLOW, key: 'vendorBill' },
  vendorPayment: { flow: PURCHASE_FLOW, key: 'vendorPayment' },
};

export interface WorkflowStageView {
  key: WorkflowStageKey;
  label: string;
  state: WorkflowStageState;
  subtitle: string;
  records: WorkflowRecordRef[];
  hidden: boolean;
  module: ProgressModule;
  route: string;
}

function isComplete(module: ProgressModule, statusCode: string): boolean {
  const path = PROGRESS_PATHS[module];
  return path[path.length - 1] === statusCode;
}

function stageState(def: StageDef, records: WorkflowRecordRef[]): WorkflowStageState {
  if (records.length === 0) return 'upcoming';
  if (records.some((r) => OFF_PATH_STATUS_CODES.has(r.statusCode))) return 'void';
  if (records.every((r) => isComplete(def.module, r.statusCode))) return 'done';
  return 'progress';
}

function stageSubtitle(records: WorkflowRecordRef[], linked: boolean): string {
  if (!linked) return 'Not linked';
  if (records.length === 0) return 'Not started';
  if (records.length > 1) return `${records.length} records`;
  return `${records[0].number} · ${records[0].status}`;
}

/** Turns a detail response's workflow block into the five stage rows the card
 *  draws. The viewed record's own stage reads "here" and shows its live status.
 *  Returns null when the page's document is not part of a flow. */
export function buildWorkflowStages(
  module: ProgressModule,
  statusLabel: string,
  workflow: WorkflowBlock,
): { stages: WorkflowStageView[]; hereIndex: number } | null {
  const placement = MODULE_STAGE[module];
  if (!placement) return null;
  const stages = placement.flow.map((def): WorkflowStageView => {
    const block = workflow.stages.find((s) => s.key === def.key);
    const records = block?.records ?? [];
    const here = def.key === placement.key;
    const state = here ? 'here' : stageState(def, records);
    return {
      key: def.key,
      label: def.label,
      state,
      subtitle: here ? statusLabel : stageSubtitle(records, Boolean(block)),
      records,
      hidden: Boolean(block?.hidden),
      module: def.module,
      route: def.route,
    };
  });
  return { stages, hereIndex: stages.findIndex((s) => s.state === 'here') };
}

const MAX_PANEL_STEPS = 8;
const PANEL_STEPS_AFTER_CURRENT = 3;

/** The sub-status list a stage's hover panel shows for one record, cut to a
 *  short window that always includes the current step. */
export function buildPanelSteps(
  module: ProgressModule,
  statusCode: string,
): { steps: ProgressStep[]; hiddenCount: number } {
  const all = buildProgressSteps(PROGRESS_PATHS[module], RECORD_PROGRESS_CONFIG[module].catalog, statusCode, PROGRESS_STATUS_ALIASES[module]);
  const currentIdx = all.findIndex((s) => s.state === 'current');
  const visible = Math.min(all.length, Math.max(MAX_PANEL_STEPS, currentIdx + PANEL_STEPS_AFTER_CURRENT));
  const shown = all.length - visible <= 1 ? all.length : visible;
  return { steps: all.slice(0, shown), hiddenCount: all.length - shown };
}
