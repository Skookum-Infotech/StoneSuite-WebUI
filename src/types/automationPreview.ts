// Mirrors automation.Preview / automation.PlanRow (the ar_dunning dry run).
export interface AutomationPreviewItem {
  invoiceUuid: string;
  number: string;
  email: string;
  stage: number;
  anchor: string;
  runAt: string;
  status: string;
  reason: string;
}

export interface AutomationPreviewRecipient {
  email: string;
  items: AutomationPreviewItem[];
}

export interface AutomationPreview {
  /** Keyed by "planned", "existing" or a skip reason (pre_enable, stale, superseded, no_email). */
  counts: Record<string, number>;
  recipients: AutomationPreviewRecipient[];
}
