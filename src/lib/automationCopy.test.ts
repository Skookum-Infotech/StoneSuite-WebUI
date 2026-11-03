import { describe, it, expect } from 'vitest';
import {
  audienceLabel,
  bannerKind,
  cadenceText,
  confirmsDisable,
  enabledSinceText,
  isNotSending,
  lastCheckedText,
  previewSkipLabel,
  ruleDescription,
} from './automationCopy';
import type { AutomationSettings } from '@/types/automationSettings';

const stages = (...d: number[]) => d.map((offsetDays) => ({ offsetDays }));

describe('cadenceText', () => {
  it.each([
    ['ar_dunning', [-3], '3 days before due date'],
    ['ar_dunning', [-3, 0, 7, 14], '3 days before due date, On the due date, 7 days after due date, 14 days after due date'],
    ['quote_expiry', [-3], '3 days before expiry'],
    ['estimate_expiry', [-3], '3 days before expiry'],
    ['approval_stuck', [2, 4, 6], '2 days after entering approval, 4 days after entering approval, 6 days after entering approval'],
    ['approval_stuck', [1], '1 day after entering approval'],
    ['anomaly_scan', [], 'Checked every 15 minutes'],
    ['mystery', [-1], '1 day before the date'],
    ['mystery', [], 'No schedule'],
  ])('%s %j', (key, offsets, want) => {
    expect(cadenceText(key, stages(...offsets))).toBe(want);
  });
});

describe('copy helpers', () => {
  it('describes every seeded key and falls back for unknown ones', () => {
    for (const key of ['ar_dunning', 'quote_expiry', 'estimate_expiry', 'approval_stuck', 'anomaly_scan']) {
      expect(ruleDescription(key)).not.toBe(ruleDescription('unknown_rule'));
    }
  });

  it('labels the audience', () => {
    expect(audienceLabel('external')).toBe('Emails customers');
    expect(audienceLabel('internal')).toBe('Internal only');
  });

  it('formats enabledAt', () => {
    expect(enabledSinceText('2026-11-02T12:00:00Z')).toBe('On since Nov 2, 2026');
    expect(enabledSinceText('nope')).toBe('');
  });

  const now = new Date('2026-11-02T14:00:00Z');
  it.each([
    [null, 'Not run yet'],
    ['2026-11-02T13:59:40Z', 'Last checked just now'],
    ['2026-11-02T13:46:00Z', 'Last checked 14 min ago'],
    ['2026-11-02T11:00:00Z', 'Last checked 3 h ago'],
    ['2026-10-30T14:00:00Z', 'Last checked 3 d ago'],
  ])('lastCheckedText %s', (iso, want) => {
    expect(lastCheckedText(iso, now)).toBe(want);
  });

  it('only external rules confirm a disable', () => {
    expect(confirmsDisable({ audience: 'external' })).toBe(true);
    expect(confirmsDisable({ audience: 'internal' })).toBe(false);
  });

  it('labels skip reasons', () => {
    expect(previewSkipLabel('no_email')).toBe('No email address on file');
    expect(previewSkipLabel('some_new_reason')).toBe('some new reason');
  });
});

describe('banner precedence', () => {
  const s = (o: Partial<AutomationSettings>): AutomationSettings => ({
    killSwitch: false,
    dailyExternalCap: 200,
    perContactWeeklyCap: 3,
    updatedAt: null,
    platformEnabled: true,
    ...o,
  });
  it.each([
    [undefined, null, false],
    [s({}), null, false],
    [s({ platformEnabled: false }), 'platform_off', true],
    [s({ platformEnabled: false, killSwitch: true }), 'platform_off', true],
    [s({ killSwitch: true }), 'paused', true],
    [s({ killSwitch: true, platformEnabled: null }), 'paused', true],
    [s({ platformEnabled: null }), 'unknown', false],
  ])('%j', (settings, banner, notSending) => {
    expect(bannerKind(settings)).toBe(banner);
    expect(isNotSending(settings)).toBe(notSending);
  });
});
