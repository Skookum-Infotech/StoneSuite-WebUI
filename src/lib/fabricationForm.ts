// Fabrication & Installation form field definitions, status catalog, and pure
// helpers — mirrors the backend fabrication/transitions.go, fabrication/
// steps.go, and fabrication/approval.go (design spec, 2026-07-22).

import type { CrmLookups } from '@/services/lookupService';
import type { FabricationJob, FabricationJobFields, FabricationJobPiece } from '@/types/fabrication';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'pieces', label: 'Pieces' },
  { key: 'slabs', label: 'Slabs' },
  { key: 'checklist', label: 'Checklist' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface FJFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'tel' | 'date' | 'readonly';
  required?: boolean;
  lookupKey?: keyof CrmLookups;
  dependsOn?: string;
  placeholder?: string;
  colSpan2?: boolean;
  colSpanFull?: boolean;
  rows?: number;
  hint?: string;
}

// ── Form section field definitions ───────────────────────────────────────────

export const SITE_FIELDS: FJFormField[] = [
  { key: 'siteCustomerName', label: 'Site Contact / Customer Name', type: 'text', placeholder: 'Defaults from the sales order shipping address' },
  { key: 'siteAddrLine1', label: 'Address Line 1', type: 'textarea', rows: 2, colSpan2: true, placeholder: '123 Main Street' },
  { key: 'siteAddrLine2', label: 'Address Line 2', type: 'textarea', rows: 2, colSpan2: true, placeholder: 'Apt, suite, floor, etc.' },
  { key: 'siteCity', label: 'City', type: 'text', placeholder: 'City' },
  { key: 'siteStateId', label: 'State', type: 'select', lookupKey: 'states' },
  { key: 'siteZip', label: 'Zip / Postal Code', type: 'text', placeholder: '12345' },
  { key: 'sitePhone', label: 'Phone', type: 'tel', placeholder: '+1 (555) 000-0000' },
];

export const SCHEDULE_FIELDS: FJFormField[] = [
  { key: 'templateDate', label: 'Template Date', type: 'date' },
  { key: 'fabricationStart', label: 'Fabrication Start', type: 'date' },
  { key: 'promisedInstallDate', label: 'Promised Install Date', type: 'date' },
];

// Employee references (owner/templater/fabricator/install crew) — sourced
// from the `employees` lookup, matching the *EmployeeId fields on the
// create/update payload.
export const CREW_FIELDS: FJFormField[] = [
  { key: 'ownerEmployeeId', label: 'Job Owner', type: 'select', lookupKey: 'employees', hint: 'Defaults to the creating user.' },
  { key: 'templaterEmployeeId', label: 'Templater', type: 'select', lookupKey: 'employees' },
  { key: 'fabricatorEmployeeId', label: 'Fabricator', type: 'select', lookupKey: 'employees' },
  { key: 'installCrewEmployeeId', label: 'Install Crew Lead', type: 'select', lookupKey: 'employees' },
];

export const NOTES_FIELDS: FJFormField[] = [
  { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, colSpanFull: true, placeholder: 'Notes related to this fabrication job…' },
];

// ── Piece editor ──────────────────────────────────────────────────────────
// Pieces can be added, edited, or removed both at create time and afterward
// via POST/PATCH/DELETE .../fabrication-jobs/{uuid}/pieces[/{pieceUuid}] —
// but only while canEditPieces(statusCode) is true (see below). The create
// page always allows editing (a brand-new job always starts at ORCV); the
// Edit/Detail pages gate the editable piece controls on that same check.

export interface FJPieceRow {
  id: string;
  pieceNumber: number;
  pieceName: string;
  pieceType: string;
  lengthMm: string;
  widthMm: string;
  thicknessMm: string;
  sinkCutoutCount: string;
  cooktopCutoutCount: string;
  seamCount: string;
  salesOrderItemUuid?: string;
}

export const EMPTY_PIECE_ROW: Omit<FJPieceRow, 'id' | 'pieceNumber'> = {
  pieceName: '',
  pieceType: '',
  lengthMm: '',
  widthMm: '',
  thicknessMm: '',
  sinkCutoutCount: '0',
  cooktopCutoutCount: '0',
  seamCount: '0',
};

// ── Status catalog (backend spec §1 — fixed, mostly-forward state machine) ──

/** All 16 `lkp_record_status` rows seeded for the FJOB record type. */
export const FJ_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'DRFT', label: 'Draft' },
  { code: 'ORCV', label: 'Order Received' },
  { code: 'MALC', label: 'Material Allocated' },
  { code: 'TMPL', label: 'Templating' },
  { code: 'TAPV', label: 'Template Approved' },
  { code: 'FRDY', label: 'Fabrication Ready' },
  { code: 'CUTG', label: 'Cutting' },
  { code: 'EDGP', label: 'Edging' },
  { code: 'QCPD', label: 'QC Pending' },
  { code: 'QCPS', label: 'QC Passed' },
  { code: 'RSHP', label: 'Ready for Shipping' },
  { code: 'TRAN', label: 'In Transit' },
  { code: 'INST', label: 'Installing' },
  { code: 'COMP', label: 'Completed' },
  { code: 'HOLD', label: 'On Hold' },
  { code: 'CANC', label: 'Cancelled' },
];

/** Legal moves offered by the forward-path status dropdown — mirrors the
 *  linear happy path plus the QCPD→EDGP rework edge from
 *  fabrication/transitions.go's `allowedTransitions`, with HOLD and CANC
 *  deliberately excluded: those are their own dedicated controls (a Hold
 *  button, a Resume button, and the multi-step Cancel dialog), not options
 *  in this dropdown. HOLD and COMP/CANC all resolve to an empty list here,
 *  which is what makes the dropdown disable itself while on hold or once the
 *  job reaches a terminal status — Resume/Cancel render alongside it instead. */
export const FJ_LINEAR_TRANSITIONS: Record<string, string[]> = {
  DRFT: ['ORCV'],
  ORCV: ['MALC'],
  MALC: ['TMPL'],
  TMPL: ['TAPV'],
  TAPV: ['FRDY'],
  FRDY: ['CUTG'],
  CUTG: ['EDGP'],
  EDGP: ['QCPD'],
  QCPD: ['QCPS', 'EDGP'],
  QCPS: ['RSHP'],
  RSHP: ['TRAN'],
  TRAN: ['INST'],
  INST: ['COMP'],
  COMP: [],
  HOLD: [],
  CANC: [],
};

/** Every status a job can be held or cancelled from — everything except the
 *  two terminal statuses (mirrors the backend's `nonTerminalStatuses`, which
 *  also excludes HOLD itself; HOLD's own hold-eligibility is handled by
 *  hiding the Hold button while already on hold). */
const NON_TERMINAL_STATUSES = new Set(
  FJ_STATUS_CODES.map((s) => s.code).filter((c) => c !== 'COMP' && c !== 'CANC' && c !== 'HOLD'),
);

export function isTerminalStatus(code: string): boolean {
  return code === 'COMP' || code === 'CANC';
}

/** Hold is offered from any live, non-held, non-terminal status. */
export function canHold(code: string): boolean {
  return NON_TERMINAL_STATUSES.has(code);
}

/** Cancel is offered from any non-terminal status, including HOLD (backend:
 *  `allowedTransitions[StatusOnHold] = {StatusCancelled: true}`). */
export function canCancel(code: string): boolean {
  return !isTerminalStatus(code);
}

/** Only draft or cancelled jobs can be deleted (SoftDelete) — a job with live
 *  slab reservations must be cancelled first to release them. */
export function canDeleteJob(code: string): boolean {
  return code === 'DRFT' || code === 'CANC';
}

/** Statuses at which pieces may still be added, edited, or removed — mirrors
 *  the backend's `canEditPieces` exactly (fabrication/transitions.go):
 *  everything before slabs get cut, minus HOLD (a held job's target status
 *  is opaque here) and the two terminal statuses. */
const PIECE_EDITABLE_STATUSES = new Set(['DRFT', 'ORCV', 'MALC', 'TMPL', 'TAPV', 'FRDY']);

export function canEditPieces(code: string): boolean {
  return PIECE_EDITABLE_STATUSES.has(code);
}

/** Status badge color, keyed by the human label (matches FJ_STATUS_CODES'
 *  labels) — shared by the list table and the detail page. */
export const FJ_STATUS_COLORS: Record<string, string> = {
  Draft: '#a8a29e',
  'Order Received': '#3b82f6',
  'Material Allocated': '#6366f1',
  Templating: '#8b5cf6',
  'Template Approved': '#a855f7',
  'Fabrication Ready': '#0ea5e9',
  Cutting: '#f59e0b',
  Edging: '#f97316',
  'QC Pending': '#eab308',
  'QC Passed': '#22c55e',
  'Ready for Shipping': '#14b8a6',
  'In Transit': '#0891b2',
  Installing: '#6366f1',
  Completed: '#10b981',
  'On Hold': '#f59e0b',
  Cancelled: '#ef4444',
};

// ── Approval gate (data-driven — spec §2.7) ──────────────────────────────────

/** Whether a job is currently blocked on approval sign-off. Prefers the
 *  live-recomputed `gated` flag (activeApproverCount > 0 && approvalStatus
 *  != approved) over the stored `approvalStatus` column alone, which goes
 *  stale the moment an admin edits the approver list out from under a job
 *  already sitting in a gated status. There is deliberately no static
 *  TAPV/QCPS check here: whether a given status gates on approval is
 *  configured per-tenant server-side (fabrication_job_approver rows), so the
 *  frontend can't know it statically. */
export function needsApproval(job: Pick<FabricationJob, 'approvalStatus'> & { gated?: boolean }): boolean {
  return job.gated ?? job.approvalStatus === 'pending';
}

export const APPROVAL_STATUS_LABELS: Record<FabricationJob['approvalStatus'], string> = {
  none: '',
  pending: 'Awaiting Approval',
  approved: 'Approved',
};

export const APPROVAL_STATUS_COLORS: Record<FabricationJob['approvalStatus'], string> = {
  none: '#a8a29e',
  pending: '#f59e0b',
  approved: '#22c55e',
};

// ── Checklist (spec §5 — 16 canonical steps) ─────────────────────────────────

export const STEP_LABELS: Record<string, string> = {
  INTAKE_VERIFY: 'Order Intake & Verification',
  SLAB_ALLOCATE: 'Inventory Check & Slab Allocation',
  TEMPLATING: 'Digital/Physical Templating',
  SLAB_LAYOUT: 'Slab Layout & Programming',
  SAW_CUTTING: 'Primary Saw Cutting',
  CNC_CUTTING: 'CNC Route / Waterjet Cutting',
  EDGE_PROFILE: 'Edge Profiling & Polishing',
  HAND_POLISH: 'Manual Detailing & Hand Polishing',
  RODDING: 'Rodding & Reinforcement',
  DRY_RUN: 'Layout Match & Dry Run',
  FINAL_QC: 'Final Quality Control',
  SEALING: 'Sealing & Treatment',
  BUNDLE_LOAD: 'Bundling & A-Frame Loading',
  DISPATCH: 'Dispatch & Logistics',
  SITE_INSTALL: 'Site Installation',
  SIGN_OFF: 'Post-Install Sign-off',
};

export const STEP_STATUS_OPTIONS = ['pending', 'in_progress', 'blocked', 'skipped', 'completed'] as const;

export const STEP_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  skipped: 'Skipped',
  completed: 'Completed',
};

export const STEP_STATUS_COLORS: Record<string, string> = {
  pending: '#a8a29e',
  in_progress: '#3b82f6',
  blocked: '#ef4444',
  skipped: '#f59e0b',
  completed: '#22c55e',
};

// ── Disposition (spec §4.4.1 — cancel-after-cutting) ─────────────────────────

export const DISPOSITION_OPTIONS = ['recovered', 'scrapped', 'delivered'] as const;

export const DISPOSITION_LABELS: Record<string, string> = {
  recovered: 'Recovered as offcut',
  scrapped: 'Scrapped',
  delivered: 'Delivered to customer',
};

// ── Form defaults / payload mapping ──────────────────────────────────────────

export function fjDefaults(): Record<string, unknown> {
  return {};
}

function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

function toIntOrNull(v: unknown): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/** id-or-empty for a lookupKey <select>'s bound value: null/undefined must
 *  render as "— Select —" (empty string), never "0" or "null". */
function idOrEmpty(id: number | null | undefined): string {
  return id === null || id === undefined ? '' : String(id);
}

/** Maps the form's flat data record to the header-only update/create fields
 *  shared by both payload shapes. */
export function toJobFields(
  data: Record<string, unknown>,
  customFields: Record<string, unknown> = {},
): FabricationJobFields {
  return {
    siteCustomerName: toStr(data.siteCustomerName) || undefined,
    siteAddrLine1: toStr(data.siteAddrLine1) || undefined,
    siteAddrLine2: toStr(data.siteAddrLine2) || undefined,
    siteCity: toStr(data.siteCity) || undefined,
    siteStateId: toIntOrNull(data.siteStateId),
    siteZip: toStr(data.siteZip) || undefined,
    sitePhone: toStr(data.sitePhone) || undefined,
    templateDate: toStr(data.templateDate) || undefined,
    fabricationStart: toStr(data.fabricationStart) || undefined,
    promisedInstallDate: toStr(data.promisedInstallDate) || undefined,
    ownerEmployeeId: toIntOrNull(data.ownerEmployeeId),
    templaterEmployeeId: toIntOrNull(data.templaterEmployeeId),
    fabricatorEmployeeId: toIntOrNull(data.fabricatorEmployeeId),
    installCrewEmployeeId: toIntOrNull(data.installCrewEmployeeId),
    notes: toStr(data.notes) || undefined,
    customFields,
  };
}

/** Maps one editable piece row to the create payload's piece shape. Empty
 *  numeric fields fall back to 0 rather than NaN so a partially-filled row
 *  never serializes as invalid JSON. */
export function toPieceInput(row: FJPieceRow) {
  return {
    pieceNumber: row.pieceNumber,
    pieceName: row.pieceName,
    pieceType: row.pieceType,
    lengthMm: parseFloat(row.lengthMm) || 0,
    widthMm: parseFloat(row.widthMm) || 0,
    thicknessMm: parseFloat(row.thicknessMm) || 0,
    sinkCutoutCount: parseInt(row.sinkCutoutCount, 10) || 0,
    cooktopCutoutCount: parseInt(row.cooktopCutoutCount, 10) || 0,
    seamCount: parseInt(row.seamCount, 10) || 0,
    salesOrderItemUuid: row.salesOrderItemUuid || undefined,
  };
}

/** Maps a loaded FabricationJobPiece (GET response) to an editable row — the
 *  inverse of toPieceInput, used when editing an existing piece post-create.
 *  Carries `salesOrderItemUuid` through unchanged so re-saving a piece the
 *  user didn't touch that field on doesn't silently clear the link. */
export function pieceToRow(piece: FabricationJobPiece): FJPieceRow {
  return {
    id: piece.id,
    pieceNumber: piece.pieceNumber,
    pieceName: piece.pieceName,
    pieceType: piece.pieceType,
    lengthMm: String(piece.lengthMm),
    widthMm: String(piece.widthMm),
    thicknessMm: String(piece.thicknessMm),
    sinkCutoutCount: String(piece.sinkCutoutCount),
    cooktopCutoutCount: String(piece.cooktopCutoutCount),
    seamCount: String(piece.seamCount),
    salesOrderItemUuid: piece.salesOrderItemUuid,
  };
}

/** Maps a loaded FabricationJob (GET response) back to the Edit form's flat
 *  data record — the inverse of toJobFields. */
export function fromJob(job: FabricationJob): Record<string, unknown> {
  return {
    siteCustomerName: job.site.customerName ?? '',
    siteAddrLine1: job.site.addrLine1 ?? '',
    siteAddrLine2: job.site.addrLine2 ?? '',
    siteCity: job.site.city ?? '',
    siteStateId: idOrEmpty(job.site.stateId),
    siteZip: job.site.zip ?? '',
    sitePhone: job.site.phone ?? '',
    templateDate: job.templateDate ?? '',
    fabricationStart: job.fabricationStart ?? '',
    promisedInstallDate: job.promisedInstallDate ?? '',
    ownerEmployeeId: idOrEmpty(job.ownerEmployeeId),
    templaterEmployeeId: idOrEmpty(job.templaterEmployeeId),
    fabricatorEmployeeId: idOrEmpty(job.fabricatorEmployeeId),
    installCrewEmployeeId: idOrEmpty(job.installCrewEmployeeId),
    notes: job.notes ?? '',
  };
}
