import type { AutomationCadenceStage, AutomationRule } from '@/types/automationRule';
import type { AutomationSettings } from '@/types/automationSettings';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Seeded rule keys (automation/rule.go on the backend). */
export const RULE_KEY = {
  arDunning: 'ar_dunning',
  quoteExpiry: 'quote_expiry',
  estimateExpiry: 'estimate_expiry',
  approvalStuck: 'approval_stuck',
  anomalyScan: 'anomaly_scan',
} as const;

export const ANOMALIES_PATH = '/anomalies';
export const DELIVERIES_PATH = '/config/automation/deliveries';
export const NO_CONFIGURE_PERMISSION = 'You need permission to configure automation.';

/** What each rule does, in the customer's words — keyed by ruleKey, since the server sends only a name. */
const RULE_DESCRIPTIONS: Record<string, string> = {
  [RULE_KEY.arDunning]: 'Emails customers before an invoice is due and when it becomes overdue.',
  [RULE_KEY.quoteExpiry]: 'Reminds the quote owner before a quote expires.',
  [RULE_KEY.estimateExpiry]: 'Reminds the estimate owner before an estimate expires.',
  [RULE_KEY.approvalStuck]: 'Reminds approvers when a record has been waiting for approval too long.',
  [RULE_KEY.anomalyScan]: 'Checks the workspace for unusual activity and alerts the people who can act on it.',
};
const FALLBACK_DESCRIPTION = 'A scheduled reminder StoneSuite sends on your behalf.';

/** What each cadence offset is measured from. */
interface CadenceAnchor {
  before: string;
  after: string;
  on: string;
}
const ANCHOR_BY_RULE: Record<string, CadenceAnchor> = {
  [RULE_KEY.arDunning]: { before: 'before due date', after: 'after due date', on: 'On the due date' },
  [RULE_KEY.quoteExpiry]: { before: 'before expiry', after: 'after expiry', on: 'On the expiry date' },
  [RULE_KEY.estimateExpiry]: { before: 'before expiry', after: 'after expiry', on: 'On the expiry date' },
  [RULE_KEY.approvalStuck]: {
    before: 'before entering approval',
    after: 'after entering approval',
    on: 'When entering approval',
  },
};
const FALLBACK_ANCHOR: CadenceAnchor = { before: 'before the date', after: 'after the date', on: 'On the date' };
const ANOMALY_CADENCE = 'Checked every 15 minutes';
const NO_CADENCE = 'No schedule';

export function ruleDescription(ruleKey: string): string {
  return RULE_DESCRIPTIONS[ruleKey] ?? FALLBACK_DESCRIPTION;
}

export function audienceLabel(audience: AutomationRule['audience']): string {
  return audience === 'external' ? 'Emails customers' : 'Internal only';
}

function dayCount(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

function stageText(ruleKey: string, offsetDays: number): string {
  const anchor = ANCHOR_BY_RULE[ruleKey] ?? FALLBACK_ANCHOR;
  if (offsetDays === 0) return anchor.on;
  return offsetDays < 0
    ? `${dayCount(-offsetDays)} ${anchor.before}`
    : `${dayCount(offsetDays)} ${anchor.after}`;
}

/** The cadence in words, e.g. "3 days before due date, On the due date, 7 days after due date". */
export function cadenceText(ruleKey: string, cadence: ReadonlyArray<AutomationCadenceStage>): string {
  if (ruleKey === RULE_KEY.anomalyScan) return ANOMALY_CADENCE;
  if (cadence.length === 0) return NO_CADENCE;
  return cadence.map((c) => stageText(ruleKey, c.offsetDays)).join(', ');
}

/** "On since Nov 2, 2026". */
export function enabledSinceText(enabledAt: string): string {
  const d = new Date(enabledAt);
  if (Number.isNaN(d.getTime())) return '';
  return `On since ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/** "Last checked 14 min ago" / "Not run yet". */
export function lastCheckedText(lastPlannedAt: string | null, now: Date = new Date()): string {
  if (!lastPlannedAt) return 'Not run yet';
  const diff = now.getTime() - new Date(lastPlannedAt).getTime();
  if (Number.isNaN(diff)) return 'Not run yet';
  if (diff < MINUTE_MS) return 'Last checked just now';
  if (diff < HOUR_MS) return `Last checked ${Math.floor(diff / MINUTE_MS)} min ago`;
  if (diff < DAY_MS) return `Last checked ${Math.floor(diff / HOUR_MS)} h ago`;
  return `Last checked ${Math.floor(diff / DAY_MS)} d ago`;
}

export type AutomationBanner = 'platform_off' | 'paused' | 'unknown' | null;

/** Which status banner shows, by precedence: platform off, workspace paused, scheduler unknown. */
export function bannerKind(settings: AutomationSettings | undefined): AutomationBanner {
  if (!settings) return null;
  if (settings.platformEnabled === false) return 'platform_off';
  if (settings.killSwitch) return 'paused';
  if (settings.platformEnabled === null) return 'unknown';
  return null;
}

/** True when an enabled rule will not actually send (platform off or workspace paused). */
export function isNotSending(settings: AutomationSettings | undefined): boolean {
  return settings !== undefined && (settings.platformEnabled === false || settings.killSwitch);
}

export const BANNER_TEXT = {
  platform_off:
    'Automation is turned off for the whole platform by StoneSuite support. Rules marked On will start sending once it is turned back on.',
  paused: 'All automated emails are paused for this workspace.',
  unknown: 'We could not confirm whether the scheduler is running.',
} as const;

export function disableConfirmTitle(name: string): string {
  return `Turn off ${name}?`;
}
export const DISABLE_CONFIRM_BODY = 'Reminders already planned and not yet sent will be cancelled.';

export function enableConfirmTitle(name: string): string {
  return `Turn on ${name}?`;
}
export function enableConfirmBody(ruleKey: string): string {
  return ruleKey === RULE_KEY.arDunning
    ? 'Reminders start from today. Invoices that were already overdue will not receive past reminders.'
    : 'Reminders start from today. Records that are already past their reminder dates will not receive past reminders.';
}

/** Whether turning this rule off asks first: only rules that email customers do. */
export function confirmsDisable(rule: Pick<AutomationRule, 'audience'>): boolean {
  return rule.audience === 'external';
}

const PREVIEW_SKIP_LABELS: Record<string, string> = {
  pre_enable: 'Due before the rule was turned on',
  stale: 'Too old to send',
  superseded: 'Replaced by a newer reminder',
  no_email: 'No email address on file',
};

export const PREVIEW_PLANNED_KEY = 'planned';
export const PREVIEW_EXISTING_KEY = 'existing';

export function previewSkipLabel(reason: string): string {
  return PREVIEW_SKIP_LABELS[reason] ?? reason.replace(/_/g, ' ');
}
