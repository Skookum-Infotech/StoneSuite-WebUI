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

/** The slice of a document's status path a stage covers, for a document that
 *  spans two stages (a fabrication job runs through Fabrication, then Installation). */
interface PathWindow {
  /** First status of the slice; a record before it has not reached the stage. */
  start: string;
  /** Last status of the slice; a record at or past it has finished the stage. */
  end: string;
}

interface StageDef {
  key: WorkflowStageKey;
  label: string;
  /** The module whose status path this stage's hover panel shows. */
  module: ProgressModule;
  /** Detail-page route prefix; the record id is appended. */
  route: string;
  /** The stage whose records this one reads, when two stages share a document. */
  source?: WorkflowStageKey;
  window?: PathWindow;
}

const FABRICATION_HANDOFF = 'TRAN';

/** A stage's light palette: a pale fill, a mid-tone ring and a dark mark/text. */
export interface StagePalette {
  tint: string;
  ring: string;
  ink: string;
}

const LIME: StagePalette = { tint: '#ecfccb', ring: '#99c466', ink: '#365314' };       // accent-lime, brand-hover, accent-lime-text
const PURPLE: StagePalette = { tint: '#f3e8ff', ring: '#a855f7', ink: '#7e22ce' };     // workflow-lead pair, Template Approved hex
const BLUE: StagePalette = { tint: '#eff6ff', ring: '#3b82f6', ink: '#1d4ed8' };       // file-doc pair, Approved hex
const AMBER: StagePalette = { tint: '#fffbeb', ring: '#f59e0b', ink: '#b45309' };      // file-image pair, Pending hex
const GREEN: StagePalette = { tint: '#f0fdf4', ring: '#10b981', ink: '#15803d' };      // file-sheet pair, Paid hex
const ROSE: StagePalette = { tint: '#fff1f2', ring: '#fb7185', ink: '#be123c' };       // file-pdf pair
const TEAL: StagePalette = { tint: '#e6f1f3', ring: '#2c6e7f', ink: '#1f5563' };       // --color-teal, tinted

/** One light palette per stage, from StoneSuite's own tokens, so a finished
 *  flow reads as a row of distinct, soft stages. */
export const STAGE_COLORS: Record<WorkflowStageKey, StagePalette> = {
  quote: PURPLE,
  salesOrder: LIME,
  fabrication: AMBER,
  installation: TEAL,
  invoice: BLUE,
  payment: GREEN,
  refund: ROSE,
  requisition: PURPLE,
  purchaseOrder: BLUE,
  receiving: AMBER,
  vendorBill: TEAL,
  vendorPayment: GREEN,
};


export const SALES_FLOW: StageDef[] = [
  { key: 'quote', label: 'Quote', module: 'quote', route: '/sales/quote' },
  { key: 'salesOrder', label: 'Sales order', module: 'salesOrder', route: '/sales/sales_order' },
  { key: 'fabrication', label: 'Fabrication', module: 'fabrication', route: '/sales/installation', window: { start: 'DRFT', end: 'RSHP' } },
  { key: 'installation', label: 'Installation', module: 'fabrication', route: '/sales/installation', source: 'fabrication', window: { start: FABRICATION_HANDOFF, end: 'COMP' } },
  { key: 'invoice', label: 'Invoice', module: 'invoice', route: '/sales/invoice' },
  { key: 'payment', label: 'Payment', module: 'payment', route: '/sales/payment' },
  { key: 'refund', label: 'Refund', module: 'refund', route: '/sales/refund' },
];

export const PURCHASE_FLOW: StageDef[] = [
  { key: 'requisition', label: 'Requisition', module: 'requisition', route: '/purchases/requisition' },
  { key: 'purchaseOrder', label: 'Purchase order', module: 'purchaseOrder', route: '/purchases/purchase_order' },
  { key: 'receiving', label: 'Receiving', module: 'itemReceipt', route: '/purchases/item_receipt' },
  { key: 'vendorBill', label: 'Vendor bill', module: 'vendorBill', route: '/purchases/vendor_bill' },
  { key: 'vendorPayment', label: 'Payment', module: 'vendorPayment', route: '/purchases/vendor_payment' },
];

/** Which stage the page's own record sits on, and which flow it belongs to.
 *  Documents outside both flows (estimate, credit memo, vendor credit, expense)
 *  are absent. A fabrication job sits on Fabrication until it ships, then on
 *  Installation; see `hereKey`. */
export const MODULE_STAGE: Partial<Record<ProgressModule, { flow: StageDef[]; key: WorkflowStageKey }>> = {
  quote: { flow: SALES_FLOW, key: 'quote' },
  salesOrder: { flow: SALES_FLOW, key: 'salesOrder' },
  fabrication: { flow: SALES_FLOW, key: 'fabrication' },
  invoice: { flow: SALES_FLOW, key: 'invoice' },
  payment: { flow: SALES_FLOW, key: 'payment' },
  refund: { flow: SALES_FLOW, key: 'refund' },
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
  /** This stage's own palette; absent while nothing has started in it. */
  color?: StagePalette;
  /** The viewed record is at the last status of this stage. */
  complete: boolean;
  /** Set when the stage covers only part of its document's status path. */
  window?: PathWindow;
}

function pathIndex(module: ProgressModule, statusCode: string): number {
  return PROGRESS_PATHS[module].indexOf(statusCode);
}

function isComplete(def: StageDef, statusCode: string): boolean {
  const path = PROGRESS_PATHS[def.module];
  const endCode = def.window?.end ?? path[path.length - 1];
  return pathIndex(def.module, statusCode) >= path.indexOf(endCode) && path.includes(statusCode);
}

function hasStarted(def: StageDef, statusCode: string): boolean {
  if (!def.window) return true;
  return pathIndex(def.module, statusCode) >= pathIndex(def.module, def.window.start);
}

function stageState(def: StageDef, records: WorkflowRecordRef[]): WorkflowStageState {
  if (records.length === 0) return 'upcoming';
  if (records.some((r) => OFF_PATH_STATUS_CODES.has(r.statusCode))) return 'void';
  if (records.every((r) => isComplete(def, r.statusCode))) return 'done';
  if (records.every((r) => !hasStarted(def, r.statusCode))) return 'upcoming';
  return 'progress';
}

function stageSubtitle(def: StageDef, records: WorkflowRecordRef[], linked: boolean, state: WorkflowStageState): string {
  if (!linked) return 'Not linked';
  if (records.length === 0) return def.key === 'refund' ? 'No refund' : 'Not started';
  if (state === 'upcoming') return 'Not started';
  if (records.length > 1) return `${records.length} records`;
  return `${records[0].number} · ${records[0].status}`;
}

/** The stage a record sits on. A fabrication job moves from Fabrication to
 *  Installation once it ships. */
function hereKey(module: ProgressModule, statusCode: string | undefined, fallback: WorkflowStageKey): WorkflowStageKey {
  if (module !== 'fabrication' || !statusCode) return fallback;
  return pathIndex('fabrication', statusCode) >= pathIndex('fabrication', FABRICATION_HANDOFF) ? 'installation' : 'fabrication';
}

/** Turns a detail response's workflow block into the stage rows the card
 *  draws. The viewed record's own stage reads "here" and shows its live status.
 *  Returns null when the page's document is not part of a flow. */
export function buildWorkflowStages(
  module: ProgressModule,
  statusLabel: string,
  workflow: WorkflowBlock,
  statusCode?: string,
): { stages: WorkflowStageView[]; hereIndex: number } | null {
  const placement = MODULE_STAGE[module];
  if (!placement) return null;
  const currentKey = hereKey(module, statusCode, placement.key);
  const stages = placement.flow.map((def): WorkflowStageView => {
    const block = workflow.stages.find((s) => s.key === (def.source ?? def.key));
    const records = block?.records ?? [];
    const here = def.key === currentKey;
    const state = here ? 'here' : stageState(def, records);
    return {
      key: def.key,
      label: def.label,
      state,
      subtitle: here ? statusLabel : stageSubtitle(def, records, Boolean(block), state),
      records,
      hidden: Boolean(block?.hidden),
      module: def.module,
      route: def.route,
      color: state !== 'upcoming' ? STAGE_COLORS[def.key] : undefined,
      complete: here ? Boolean(statusCode) && isComplete(def, statusCode as string) : state === 'done',
      window: def.window,
    };
  });
  return { stages, hereIndex: stages.findIndex((s) => s.state === 'here') };
}

/** Narrows the full flow to what this customer actually has: the page's own
 *  stage, every stage holding at least one record that has started, and a stage
 *  the server says has records the caller may not see. Empty stages (Not linked,
 *  Not started, No refund) are dropped, so a record that went Quote, then Invoice
 *  shows just those, not the whole A to Z. */
export function onlyLinkedStages(view: { stages: WorkflowStageView[] }): { stages: WorkflowStageView[]; hereIndex: number } {
  const stages = view.stages.filter((s) => s.state === 'here' || s.hidden || (s.records.length > 0 && s.state !== 'upcoming'));
  return { stages, hereIndex: stages.findIndex((s) => s.state === 'here') };
}

const MAX_PANEL_STEPS = 8;
const PANEL_STEPS_AFTER_CURRENT = 3;

/** The sub-status list a stage's hover panel shows for one record, cut to a
 *  short window that always includes the current step. A stage that covers
 *  only part of a document's path lists just that part. `expanded` lists every
 *  step instead of the short window. */
export function buildPanelSteps(
  module: ProgressModule,
  statusCode: string,
  window?: PathWindow,
  expanded = false,
): { steps: ProgressStep[]; hiddenCount: number } {
  const path = PROGRESS_PATHS[module];
  const from = window ? path.indexOf(window.start) : 0;
  const to = window ? path.indexOf(window.end) + 1 : path.length;
  const all = buildProgressSteps(path, RECORD_PROGRESS_CONFIG[module].catalog, statusCode, PROGRESS_STATUS_ALIASES[module]).slice(from, to);
  const currentIdx = all.findIndex((s) => s.state === 'current');
  const visible = Math.min(all.length, Math.max(MAX_PANEL_STEPS, currentIdx + PANEL_STEPS_AFTER_CURRENT));
  const shown = expanded || all.length - visible <= 1 ? all.length : visible;
  return { steps: all.slice(0, shown), hiddenCount: all.length - shown };
}
