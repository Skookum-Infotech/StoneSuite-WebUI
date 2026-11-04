import { RULE_KEY } from '@/lib/automationCopy';
import type { AutomationAudience, AutomationRuleInput } from '@/types/automationRule';

export const RULE_NAME_MAX = 200;
export const MAX_STAGES = 10;
export const MAX_OFFSET_DAYS = 365;

export type StageDirection = 'before' | 'after';

export interface StageDraft {
  days: string;
  direction: StageDirection;
}

export interface RuleKindOption {
  kind: string;
  label: string;
  audience: AutomationAudience;
  /** What the stage days are counted from, e.g. "due date". */
  anchor: string;
}

/** Rule kinds a workspace can add another rule of. Audience is fixed by the kind. */
export const RULE_KIND_OPTIONS: ReadonlyArray<RuleKindOption> = [
  { kind: RULE_KEY.arDunning, label: 'Invoice payment reminders', audience: 'external', anchor: 'due date' },
  { kind: RULE_KEY.quoteExpiry, label: 'Quote expiry reminders', audience: 'internal', anchor: 'expiry date' },
  { kind: RULE_KEY.estimateExpiry, label: 'Estimate expiry reminders', audience: 'internal', anchor: 'expiry date' },
  { kind: RULE_KEY.approvalStuck, label: 'Approval stuck reminders', audience: 'internal', anchor: 'entering approval' },
];

export const DEFAULT_STAGE: StageDraft = { days: '3', direction: 'before' };

export function kindOption(kind: string): RuleKindOption | undefined {
  return RULE_KIND_OPTIONS.find((o) => o.kind === kind);
}

/** Signed offset for a stage, or null if its days are not a whole number in range. */
export function stageOffset(stage: StageDraft): number | null {
  const trimmed = stage.days.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (n > MAX_OFFSET_DAYS) return null;
  return stage.direction === 'before' && n > 0 ? -n : n;
}

/** The first problem with the draft, or null when it can be submitted. */
export function validateRuleDraft(name: string, kind: string, stages: ReadonlyArray<StageDraft>): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Give the rule a name.';
  if (trimmed.length > RULE_NAME_MAX) return `Name must be ${RULE_NAME_MAX} characters or fewer.`;
  if (!kindOption(kind)) return 'Choose what the rule reminds about.';
  if (stages.length === 0) return 'Add at least one reminder.';
  if (stages.length > MAX_STAGES) return `A rule can have at most ${MAX_STAGES} reminders.`;
  const offsets = stages.map(stageOffset);
  if (offsets.some((o) => o === null)) return `Days must be a whole number from 0 to ${MAX_OFFSET_DAYS}.`;
  if (new Set(offsets).size !== offsets.length) return 'Each reminder must fall on a different day.';
  return null;
}

/** Request body for creating a rule; call only after validateRuleDraft returns null. */
export function buildRuleInput(name: string, kind: string, stages: ReadonlyArray<StageDraft>): AutomationRuleInput {
  const option = kindOption(kind);
  const offsets = stages.map(stageOffset).filter((o): o is number => o !== null);
  return {
    name: name.trim(),
    kind,
    audience: option?.audience ?? 'internal',
    cadence: [...offsets].sort((a, b) => a - b).map((offsetDays) => ({ offsetDays })),
  };
}
