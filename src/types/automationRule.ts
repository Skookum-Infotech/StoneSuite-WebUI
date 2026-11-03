// Mirrors the backend's controllers.AutomationRule (automation_rules_store.go).
export interface AutomationCadenceStage {
  /** Days relative to the rule's anchor date (negative = before it). */
  offsetDays: number;
}

export interface AutomationRule {
  ruleKey: string;
  name: string;
  audience: 'internal' | 'external';
  enabled: boolean;
  enabledAt: string | null;
  cadence: AutomationCadenceStage[];
  isSystem: boolean;
  previewSupported: boolean;
  lastPlannedAt: string | null;
}
