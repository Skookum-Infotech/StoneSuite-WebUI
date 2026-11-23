/** Kind of record change a proposed action will perform once confirmed. */
export type ProposedActionKind = 'create' | 'update';

/** Where the proposal originated. */
export type ProposedActionSource = 'agent' | 'docextract';

/** Lifecycle status of a proposed action. */
export type ProposedActionStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired' | 'failed';

/** One label/value row shown in the confirmation preview. */
export interface ProposedActionField {
  label: string;
  value: string;
}

/** Human-readable preview of the change (the server never returns the raw payload). */
export interface ProposedActionPreview {
  title: string;
  summary: string;
  fields: ProposedActionField[];
}

/** Reference to the record produced by a confirmed action. */
export interface ProposedActionResultRef {
  resource: string;
  recordId: string;
  label: string;
}

/** A change proposed by an agent/extraction that awaits explicit user confirmation. */
export interface ProposedAction {
  id: string;
  kind: ProposedActionKind;
  resource: string;
  preview: ProposedActionPreview;
  source: ProposedActionSource;
  status: ProposedActionStatus;
  resultRef?: ProposedActionResultRef;
  errorMessage?: string;
  expiresAt: string;
  createdAt: string;
  resolvedAt?: string;
}

/** One page of the caller's proposed actions. */
export interface ProposedActionPage {
  actions: ProposedAction[];
  nextCursor: string;
}

/** Result of confirming an action; `replayed` is true when it was already confirmed. */
export interface ProposedActionConfirmResult {
  action: ProposedAction;
  replayed: boolean;
  message: string;
}
