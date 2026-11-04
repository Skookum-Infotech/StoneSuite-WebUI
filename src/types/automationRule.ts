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

export type AutomationAudience = AutomationRule['audience'];

/** Body of POST /api/tenant/automation/rules; the server assigns the ruleKey. */
export interface AutomationRuleInput {
  name: string;
  /** The built-in rule kind this rule behaves like (e.g. ar_dunning). */
  kind: string;
  audience: AutomationAudience;
  cadence: AutomationCadenceStage[];
}
