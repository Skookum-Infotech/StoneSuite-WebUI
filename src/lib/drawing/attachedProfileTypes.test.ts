import { describe, expect, it } from 'vitest';
import type { AttachedProfileType, PieceEdge } from '@/types/drawing';
import { applyBorder, removeBorder } from './borders';
import {
  blankAttachedProfileTypeDraft, checkAttachedProfileTypeDraft, draftFromAttachedProfileType,
  MAX_PROFILE_ALIAS_LENGTH, MAX_PROFILE_NAME_LENGTH, paintedProfileSides, paintProfileSide,
  type AttachedProfileTypeDraft,
} from './attachedProfileTypes';
import { rectOutline } from './geometry';

const BACKSPLASH: AttachedProfileType = {
  id: 'p1', name: 'Backsplash', pricingType: 'linear', price: 12, alias: 'BS', color: '#2563eb',
  measurementPresetsMm: [101.6, 152.4], angle: 90, finish: 'none', isSystem: true,
};
const LAMINATION: AttachedProfileType = {
  id: 'p2', name: 'Lamination', pricingType: 'linear', price: 18, alias: 'LM', color: '#9333ea',
  measurementPresetsMm: [38.1], angle: 180, finish: 'mitered', isSystem: true,
};
const TYPES = [BACKSPLASH, LAMINATION];

const draft = (change: Partial<AttachedProfileTypeDraft> = {}): AttachedProfileTypeDraft => (
  { ...blankAttachedProfileTypeDraft(), name: 'Waterfall', measurementPresets: ['609.6'], ...change }
);

describe('blankAttachedProfileTypeDraft', () => {
  it('starts empty, priced at nothing, flat and unmitered, with one blank measurement', () => {
    expect(blankAttachedProfileTypeDraft()).toMatchObject({
      name: '', price: '0.00', alias: '', pricingType: 'linear', angle: 180, finish: 'none', measurementPresets: [''],
    });
  });
});

describe('draftFromAttachedProfileType', () => {
  it('shows the price to the cent and the presets as text', () => {
    expect(draftFromAttachedProfileType(LAMINATION)).toEqual({
      name: 'Lamination', pricingType: 'linear', price: '18.00', alias: 'LM', color: '#9333ea',
      measurementPresets: ['38.1'], angle: 180, finish: 'mitered',
    });
  });
});

describe('checkAttachedProfileTypeDraft', () => {
  it('turns a good draft into what the server is sent, tidied', () => {
    const result = checkAttachedProfileTypeDraft(
      draft({ name: '  Waterfall ', alias: ' WF ', price: '22.345', color: '#AA00FF', angle: 270, finish: 'mitered', measurementPresets: [' 609.6 ', '762'] }),
      TYPES,
    );
    expect(result).toEqual({
      ok: true,
      input: {
        name: 'Waterfall', alias: 'WF', pricingType: 'linear', price: 22.35, color: '#aa00ff',
        angle: 270, finish: 'mitered', measurementPresetsMm: [609.6, 762],
      },
    });
  });

  it.each([
    ['a blank name', { name: '   ' }, 'Enter a name for the profile.'],
    ['a name that is too long', { name: 'x'.repeat(MAX_PROFILE_NAME_LENGTH + 1) }, 'The name is too long.'],
    ['a name already used, whatever its case', { name: 'LAMINATION' }, 'A profile with that name already exists.'],
    ['an alias that is too long', { alias: 'x'.repeat(MAX_PROFILE_ALIAS_LENGTH + 1) }, 'The alias is too long.'],
    ['a blank price', { price: '' }, 'Enter a price of zero or more.'],
    ['a negative price', { price: '-1' }, 'Enter a price of zero or more.'],
    ['a price that is too large', { price: '99999999999' }, 'That price is too large.'],
    ['a colour that is not #rrggbb', { color: 'green' }, 'Pick a colour.'],
    ['no measurements', { measurementPresets: ['', ' '] }, 'Add at least one measurement.'],
    ['a zero measurement', { measurementPresets: ['0'] }, 'Enter a measurement greater than zero.'],
    ['a measurement that is too large', { measurementPresets: ['999999'] }, 'A measurement is too large.'],
  ] as [string, Partial<AttachedProfileTypeDraft>, string][])('refuses %s', (_name, change, error) => {
    expect(checkAttachedProfileTypeDraft(draft(change), TYPES)).toEqual({ ok: false, error });
  });

  it('lets a type keep its own name while it is edited', () => {
    expect(checkAttachedProfileTypeDraft(draft({ name: 'lamination' }), TYPES, LAMINATION.id).ok).toBe(true);
  });

  it('accepts a price of zero, no alias, and several measurements', () => {
    expect(checkAttachedProfileTypeDraft(draft({ price: '0', alias: '', measurementPresets: ['100', '150'] }), TYPES).ok).toBe(true);
  });
});

describe('paintProfileSide', () => {
  it('records the type and measurement on the side and leaves its other settings alone', () => {
    const edges: PieceEdge[] = [{ index: 2, code: 'EE', overhangMm: 25 }];
    expect(paintProfileSide(edges, 2, 'p1', 101.6)).toEqual([
      { index: 2, code: 'EE', overhangMm: 25, attachedProfile: { profileTypeId: 'p1', measurementMm: 101.6 } },
    ]);
  });

  it('adds the side in order, and repainting replaces the type and measurement', () => {
    const once = paintProfileSide([{ index: 3, attachedProfile: { profileTypeId: 'p1', measurementMm: 101.6 } }], 1, 'p1', 152.4);
    expect(once.map((e) => e.index)).toEqual([1, 3]);
    expect(paintProfileSide(once, 3, 'p2', 38.1).find((e) => e.index === 3)?.attachedProfile).toEqual({ profileTypeId: 'p2', measurementMm: 38.1 });
  });

  it('does not change the list it was given', () => {
    const edges: PieceEdge[] = [{ index: 0 }];
    paintProfileSide(edges, 0, 'p1', 100);
    expect(edges).toEqual([{ index: 0 }]);
  });
});

describe('paintedProfileSides', () => {
  it('resolves each painted side to its type and chosen measurement', () => {
    const edges: PieceEdge[] = [
      { index: 0, attachedProfile: { profileTypeId: 'p2', measurementMm: 38.1 } },
      { index: 1, code: 'EE' },
      { index: 3, attachedProfile: { profileTypeId: 'p1', measurementMm: 152.4 } },
    ];
    expect(paintedProfileSides(edges, TYPES)).toEqual([
      { index: 0, type: LAMINATION, measurementMm: 38.1 },
      { index: 3, type: BACKSPLASH, measurementMm: 152.4 },
    ]);
  });

  it('skips a side whose type is not in the list', () => {
    expect(paintedProfileSides([{ index: 0, attachedProfile: { profileTypeId: 'gone', measurementMm: 100 } }], TYPES)).toEqual([]);
    expect(paintedProfileSides([{ index: 0, attachedProfile: { profileTypeId: 'p1', measurementMm: 100 } }], [])).toEqual([]);
  });
});

describe('an attached profile through a Border change', () => {
  const rect = rectOutline(1000, 600);
  const PAINTED: PieceEdge[] = [{ index: 0, attachedProfile: { profileTypeId: 'p1', measurementMm: 101.6 } }];

  it('keeps it on the straight gaps and the bump itself, but not the legs (same rule as splash/waterfall before it)', () => {
    const result = applyBorder({ outline: rect, edges: PAINTED }, 0, 'bumpOut', { gap1Mm: 100, heightMm: 50, gap2Mm: 100 }, 'b1');
    if (!result.ok) throw new Error(result.error);
    expect(result.edges.map((e) => e.attachedProfile?.profileTypeId)).toEqual(['p1', undefined, 'p1', undefined, 'p1']);
  });

  it('keeps it on the bowed side of a full radius, and through Make standard', () => {
    const result = applyBorder({ outline: rect, edges: PAINTED }, 0, 'fullRadiusOut', { gap1Mm: 0, heightMm: 50, gap2Mm: 0 }, 'b1');
    if (!result.ok) throw new Error(result.error);
    expect(result.edges).toEqual([
      expect.objectContaining({ index: 0, attachedProfile: { profileTypeId: 'p1', measurementMm: 101.6 }, arcHeightMm: expect.any(Number) }),
    ]);

    const back = removeBorder(result, 0);
    if (!back.ok) throw new Error(back.error);
    expect(back.edges).toEqual([{ index: 0, attachedProfile: { profileTypeId: 'p1', measurementMm: 101.6 } }]);
  });
});
