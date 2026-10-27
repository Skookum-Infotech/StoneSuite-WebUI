// Mirrors the backend's controllers.AutomationRule (automation_rules_store.go).
export interface AutomationRule {
  ruleKey: string;
  name: string;
  audience: 'internal' | 'external';
  enabled: boolean;
  enabledAt: string | null;
}
