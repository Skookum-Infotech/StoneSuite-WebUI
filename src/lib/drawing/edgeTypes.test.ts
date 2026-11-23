import { describe, expect, it } from 'vitest';
import type { EdgeType, PieceEdge } from '@/types/drawing';
import { applyBorder, removeBorder } from './borders';
import { applyCorner, DEFAULT_CORNER_PARAMS } from './corners';
import { EDGE_FINISH_PROFILES } from './edgeFinishProfiles';
import {
  blankEdgeTypeDraft, checkEdgeTypeDraft, draftFromEdgeType, EDGE_FINISHES, MAX_EDGE_ALIAS_LENGTH, MAX_EDGE_NAME_LENGTH,
  paintedSides, paintSide, type EdgeTypeDraft,
} from './edgeTypes';
import { rectOutline } from './geometry';

const EASE: EdgeType = { id: 'e1', name: 'Ease', pricingType: 'linear', price: 0, alias: 'E', color: '#2563eb', finish: 'eased', isSystem: true };
const APPLIANCE: EdgeType = { id: 'e2', name: 'Appliance', pricingType: 'linear', price: 10, alias: 'A', color: '#15803d', finish: 'halfBullnose', isSystem: true };
const TYPES = [EASE, APPLIANCE];

const draft = (change: Partial<EdgeTypeDraft> = {}): EdgeTypeDraft => ({ ...blankEdgeTypeDraft(), name: 'Cove', ...change });

describe('EDGE_FINISHES', () => {
  it('lists the eight finishes, None first, and every other one has a picture', () => {
    expect(EDGE_FINISHES.map((f) => f.id)).toEqual(['none', 'raw', 'ogee', 'beveled', 'eased', 'waterfall', 'halfBullnose', 'bullnose']);
    expect(EDGE_FINISHES.filter((f) => f.id !== 'none').every((f) => f.id in EDGE_FINISH_PROFILES)).toBe(true);
    expect(Object.keys(EDGE_FINISH_PROFILES)).toHaveLength(EDGE_FINISHES.length - 1);
  });
});

describe('blankEdgeTypeDraft', () => {
  it('starts empty, priced at nothing, with no finish', () => {
    expect(blankEdgeTypeDraft()).toMatchObject({ name: '', price: '0.00', alias: '', pricingType: 'linear', finish: 'none' });
  });
});

describe('draftFromEdgeType', () => {
  it('shows the price to the cent', () => {
    expect(draftFromEdgeType(APPLIANCE)).toEqual({
      name: 'Appliance', pricingType: 'linear', price: '10.00', alias: 'A', color: '#15803d', finish: 'halfBullnose',
    });
  });
});

describe('checkEdgeTypeDraft', () => {
  it('turns a good draft into what the server is sent, tidied', () => {
    const result = checkEdgeTypeDraft(draft({ name: '  Cove ', alias: ' C ', price: '12.345', color: '#AA00FF', finish: 'bullnose' }), TYPES);
    expect(result).toEqual({
      ok: true,
      input: { name: 'Cove', alias: 'C', pricingType: 'linear', price: 12.35, color: '#aa00ff', finish: 'bullnose' },
    });
  });

  it.each([
    ['a blank name', { name: '   ' }, 'Enter a name for the edge.'],
    ['a name that is too long', { name: 'x'.repeat(MAX_EDGE_NAME_LENGTH + 1) }, 'The name is too long.'],
    ['a name already used, whatever its case', { name: 'APPLIANCE' }, 'An edge with that name already exists.'],
    ['an alias that is too long', { alias: 'x'.repeat(MAX_EDGE_ALIAS_LENGTH + 1) }, 'The alias is too long.'],
    ['a blank price', { price: '' }, 'Enter a price of zero or more.'],
    ['a negative price', { price: '-1' }, 'Enter a price of zero or more.'],
    ['a price that is not a number', { price: 'abc' }, 'Enter a price of zero or more.'],
    ['a price that is too large', { price: '99999999999' }, 'That price is too large.'],
    ['a colour that is not #rrggbb', { color: 'green' }, 'Pick a colour.'],
  ] as [string, Partial<EdgeTypeDraft>, string][])('refuses %s', (_name, change, error) => {
    expect(checkEdgeTypeDraft(draft(change), TYPES)).toEqual({ ok: false, error });
  });

  it('lets a type keep its own name while it is edited', () => {
    expect(checkEdgeTypeDraft(draft({ name: 'appliance' }), TYPES, APPLIANCE.id).ok).toBe(true);
  });

  it('accepts a price of zero and no alias', () => {
    expect(checkEdgeTypeDraft(draft({ price: '0', alias: '' }), TYPES).ok).toBe(true);
  });
});

describe('paintSide', () => {
  it('records the type on the side and leaves its other settings alone', () => {
    const edges: PieceEdge[] = [{ index: 2, code: 'EE', overhangMm: 25 }];
    expect(paintSide(edges, 2, 'e1')).toEqual([{ index: 2, code: 'EE', overhangMm: 25, edgeTypeId: 'e1' }]);
  });

  it('adds the side in order, and repainting replaces the type', () => {
    const once = paintSide([{ index: 3, edgeTypeId: 'e1' }], 1, 'e1');
    expect(once.map((e) => e.index)).toEqual([1, 3]);
    expect(paintSide(once, 3, 'e2').find((e) => e.index === 3)?.edgeTypeId).toBe('e2');
  });

  it('does not change the list it was given', () => {
    const edges: PieceEdge[] = [{ index: 0 }];
    paintSide(edges, 0, 'e1');
    expect(edges).toEqual([{ index: 0 }]);
  });
});

describe('paintedSides', () => {
  it('gives each painted side its type\'s colour', () => {
    const edges: PieceEdge[] = [{ index: 0, edgeTypeId: 'e2' }, { index: 1, code: 'EE' }, { index: 3, edgeTypeId: 'e1' }];
    expect(paintedSides(edges, TYPES)).toEqual([{ index: 0, color: '#15803d' }, { index: 3, color: '#2563eb' }]);
  });

  it('skips a side whose type is not in the list', () => {
    expect(paintedSides([{ index: 0, edgeTypeId: 'gone' }], TYPES)).toEqual([]);
    expect(paintedSides([{ index: 0, edgeTypeId: 'e1' }], [])).toEqual([]);
  });
});

describe('a painted side through a Border or Corner change', () => {
  const rect = rectOutline(1000, 600);
  const PAINTED: PieceEdge[] = [{ index: 0, edgeTypeId: 'e1' }];

  it('keeps its colour on every side of a bump, legs included', () => {
    const result = applyBorder({ outline: rect, edges: PAINTED }, 0, 'bumpOut', { gap1Mm: 100, heightMm: 50, gap2Mm: 100 }, 'b1');
    if (!result.ok) throw new Error(result.error);
    expect(result.edges.map((e) => e.edgeTypeId)).toEqual(['e1', 'e1', 'e1', 'e1', 'e1']);
  });

  it('keeps its colour on the bowed side of a full radius, and through Make standard', () => {
    const result = applyBorder({ outline: rect, edges: PAINTED }, 0, 'fullRadiusOut', { gap1Mm: 0, heightMm: 50, gap2Mm: 0 }, 'b1');
    if (!result.ok) throw new Error(result.error);
    expect(result.edges).toEqual([expect.objectContaining({ index: 0, edgeTypeId: 'e1', arcHeightMm: expect.any(Number) })]);

    const back = removeBorder(result, 0);
    if (!back.ok) throw new Error(back.error);
    expect(back.edges).toEqual([{ index: 0, edgeTypeId: 'e1' }]);
  });

  it('gives a corner cut the colour of the two sides it joins when they agree', () => {
    const edges: PieceEdge[] = [{ index: 0, edgeTypeId: 'e1' }, { index: 1, edgeTypeId: 'e1' }];
    const result = applyCorner({ outline: rect, edges }, 1, 'clip', DEFAULT_CORNER_PARAMS, 'c1');
    if (!result.ok) throw new Error(result.error);
    expect(result.edges.find((e) => e.cornerId === 'c1')?.edgeTypeId).toBe('e1');
  });

  it('leaves a corner cut unpainted when the two sides it joins disagree', () => {
    const edges: PieceEdge[] = [{ index: 0, edgeTypeId: 'e1' }, { index: 1, edgeTypeId: 'e2' }];
    const result = applyCorner({ outline: rect, edges }, 1, 'clip', DEFAULT_CORNER_PARAMS, 'c1');
    if (!result.ok) throw new Error(result.error);
    expect(result.edges.find((e) => e.cornerId === 'c1')?.edgeTypeId).toBeUndefined();
  });

  it('leaves a corner cut unpainted when only one of the sides is painted', () => {
    const result = applyCorner({ outline: rect, edges: [{ index: 0, edgeTypeId: 'e1' }] }, 1, 'clip', DEFAULT_CORNER_PARAMS, 'c1');
    if (!result.ok) throw new Error(result.error);
    expect(result.edges.find((e) => e.cornerId === 'c1')?.edgeTypeId).toBeUndefined();
  });
});
