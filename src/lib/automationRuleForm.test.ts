import { describe, it, expect } from 'vitest';
import { buildRuleInput, stageOffset, validateRuleDraft, type StageDraft } from './automationRuleForm';

const before3: StageDraft = { days: '3', direction: 'before' };
const after7: StageDraft = { days: '7', direction: 'after' };

describe('stageOffset', () => {
  it.each([
    [{ days: '3', direction: 'before' }, -3],
    [{ days: '2', direction: 'after' }, 2],
    [{ days: '0', direction: 'before' }, 0],
    [{ days: '366', direction: 'after' }, null],
    [{ days: '1.5', direction: 'after' }, null],
    [{ days: '-1', direction: 'after' }, null],
    [{ days: '', direction: 'after' }, null],
  ] as Array<[StageDraft, number | null]>)('%j -> %s', (stage, want) => {
    expect(stageOffset(stage)).toBe(want);
  });
});

describe('validateRuleDraft', () => {
  it.each([
    ['', 'ar_dunning', [before3], 'Give the rule a name.'],
    ['Nudge', 'nope', [before3], 'Choose what the rule reminds about.'],
    ['Nudge', 'ar_dunning', [], 'Add at least one reminder.'],
    ['Nudge', 'ar_dunning', [{ days: 'x', direction: 'before' }], 'Days must be a whole number from 0 to 365.'],
    ['Nudge', 'ar_dunning', [before3, before3], 'Each reminder must fall on a different day.'],
    ['Nudge', 'ar_dunning', [before3, after7], null],
  ] as Array<[string, string, StageDraft[], string | null]>)('%s / %s', (name, kind, stages, want) => {
    expect(validateRuleDraft(name, kind, stages)).toBe(want);
  });
});

describe('buildRuleInput', () => {
  it('trims, derives audience from the kind and sorts the cadence', () => {
    expect(buildRuleInput('  Early nudge ', 'ar_dunning', [after7, before3])).toEqual({
      name: 'Early nudge',
      kind: 'ar_dunning',
      audience: 'external',
      cadence: [{ offsetDays: -3 }, { offsetDays: 7 }],
    });
  });
});
