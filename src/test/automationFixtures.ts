import type { AutomationRule } from '@/types/automationRule';
import type { AutomationSettings } from '@/types/automationSettings';

/** An enabled, internal rule; override only what a test cares about. */
export function makeRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    ruleKey: 'quote_expiry',
    name: 'Quote expiry reminders',
    audience: 'internal',
    enabled: true,
    enabledAt: '2026-11-02T12:00:00Z',
    cadence: [{ offsetDays: -3 }],
    isSystem: true,
    previewSupported: false,
    lastPlannedAt: null,
    ...overrides,
  };
}

/** The invoice payment reminders rule (external, previewable). */
export function makeArDunning(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return makeRule({
    ruleKey: 'ar_dunning',
    name: 'Invoice payment reminders',
    audience: 'external',
    cadence: [{ offsetDays: -3 }, { offsetDays: 0 }, { offsetDays: 7 }],
    previewSupported: true,
    ...overrides,
  });
}

export function makeSettings(overrides: Partial<AutomationSettings> = {}): AutomationSettings {
  return {
    killSwitch: false,
    dailyExternalCap: 200,
    perContactWeeklyCap: 3,
    updatedAt: '2026-11-02T14:00:00Z',
    platformEnabled: true,
    ...overrides,
  };
}
