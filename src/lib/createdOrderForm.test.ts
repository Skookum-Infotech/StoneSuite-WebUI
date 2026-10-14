import { describe, expect, it } from 'vitest';
import {
  addableKinds,
  areaProgress,
  copyStone,
  countErrors,
  createdOrderDefaults,
  defaultAreaName,
  MAX_BACKSPLASH_HEIGHT_IN,
  newAreaDraft,
  stoneSource,
  toCreatePayload,
  validateCreatedOrder,
} from './createdOrderForm';
import type { AreaDraft, CreatedOrderFormState } from './createdOrderForm';
import type { AreaKind } from '@/types/createdOrder';

const VALID_PHONE = '+1 480 209 5330';

/** A form that passes validation, with `overrides` applied on top. */
function validForm(overrides: Partial<CreatedOrderFormState> = {}): CreatedOrderFormState {
  return {
    ...createdOrderDefaults(),
    builder: 'Highland Homes',
    community: 'Sandbrock Ranch',
    plan: '214',
    phone: VALID_PHONE,
    email: 'brandon.french@highlandhomes.com',
    installAddress: '741 Bridle Path',
    city: 'Aubrey',
    zip: '76227',
    measureDate: '2026-10-06',
    installDate: '2026-10-19',
    areas: [{ ...newAreaDraft('kitchen', 'a1', []), color: 'Serene' }],
    ...overrides,
  };
}

function area(kind: AreaKind, key: string, patch: Partial<AreaDraft> = {}): AreaDraft {
  return { ...newAreaDraft(kind, key, []), ...patch };
}

describe('defaultAreaName', () => {
  it.each<[string, AreaKind, AreaKind[], string]>([
    ['a single-use kind is just its label', 'kitchen', [], 'Kitchen'],
    ['the first repeatable area keeps the plain label', 'bath', [], 'Bath'],
    ['the second repeatable area is numbered', 'bath', ['bath'], 'Bath 2'],
    ['the third repeatable area is numbered', 'bath', ['bath', 'bath'], 'Bath 3'],
    ['other kinds do not count toward the number', 'bath', ['kitchen', 'custom'], 'Bath'],
    ['custom areas number on their own', 'custom', ['custom'], 'Custom area 2'],
  ])('%s', (_label, kind, existingKinds, expected) => {
    const existing = existingKinds.map((k, i) => area(k, `e${i}`));
    expect(defaultAreaName(kind, existing)).toBe(expected);
  });
});

describe('addableKinds', () => {
  const all: AreaKind[] = ['kitchen', 'island', 'bath'];

  it('offers every kind when nothing is added', () => {
    expect(addableKinds(all, [])).toEqual(all);
  });

  it('drops a single-use kind once it is on the order', () => {
    expect(addableKinds(all, [area('kitchen', 'k')])).toEqual(['island', 'bath']);
  });

  it('keeps a repeatable kind available after it is added', () => {
    expect(addableKinds(all, [area('bath', 'b')])).toContain('bath');
  });
});

describe('validateCreatedOrder', () => {
  it('accepts a complete order', () => {
    const errors = validateCreatedOrder(validForm());

    expect(errors.header).toEqual({});
    expect(errors.areas).toEqual({});
    expect(errors.noAreas).toBeUndefined();
    expect(countErrors(errors)).toBe(0);
  });

  it.each([
    'builder',
    'community',
    'phone',
    'email',
    'installAddress',
    'city',
    'zip',
    'measureDate',
    'installDate',
  ] as const)('requires %s', (field) => {
    const errors = validateCreatedOrder(validForm({ [field]: '   ' }));

    expect(errors.header[field]).toMatch(/required/i);
  });

  it.each(['plan', 'specialInstructions'] as const)('treats %s as optional', (field) => {
    const errors = validateCreatedOrder(validForm({ [field]: '' }));

    expect(errors.header[field]).toBeUndefined();
  });

  it.each([
    ['a number that is not dialable', '123', true],
    ['letters', 'call me', true],
    ['a valid number', VALID_PHONE, false],
  ])('phone: %s', (_label, phone, invalid) => {
    const errors = validateCreatedOrder(validForm({ phone }));

    expect(Boolean(errors.header.phone)).toBe(invalid);
  });

  it.each([
    ['no @', 'nope', true],
    ['no domain dot', 'a@b', true],
    ['a plain address', 'a@b.co', false],
  ])('email: %s', (_label, email, invalid) => {
    const errors = validateCreatedOrder(validForm({ email }));

    expect(Boolean(errors.header.email)).toBe(invalid);
  });

  it.each([
    ['install before measure', '2026-10-06', '2026-10-05', true],
    ['install on the measure day', '2026-10-06', '2026-10-06', false],
    ['install after measure', '2026-10-06', '2026-10-19', false],
  ])('dates: %s', (_label, measureDate, installDate, invalid) => {
    const errors = validateCreatedOrder(validForm({ measureDate, installDate }));

    expect(Boolean(errors.header.installDate)).toBe(invalid);
  });

  it('does not stack an ordering error on a missing Measure Date', () => {
    const errors = validateCreatedOrder(validForm({ measureDate: '' }));

    expect(errors.header.measureDate).toMatch(/required/i);
    expect(errors.header.installDate).toBeUndefined();
  });

  it('asks for at least one area', () => {
    const errors = validateCreatedOrder(validForm({ areas: [] }));

    expect(errors.noAreas).toBeDefined();
    expect(countErrors(errors)).toBe(1);
  });

  it('requires a Color on every area and reports it against that area', () => {
    const errors = validateCreatedOrder(
      validForm({ areas: [area('kitchen', 'k', { color: 'Serene' }), area('island', 'i')] }),
    );

    expect(errors.areas).toEqual({ i: { color: 'Color is required.' } });
  });

  it('requires a name on a Bath or Custom area', () => {
    const errors = validateCreatedOrder(validForm({ areas: [area('bath', 'b', { color: 'White', name: '  ' })] }));

    expect(errors.areas.b?.name).toBeDefined();
  });

  it.each([
    ['empty', '', false],
    ['a normal height', '4', false],
    ['a quarter inch', '4.25', false],
    ['the maximum', String(MAX_BACKSPLASH_HEIGHT_IN), false],
    ['over the maximum', String(MAX_BACKSPLASH_HEIGHT_IN + 1), true],
    ['negative', '-1', true],
    ['not a number', 'tall', true],
  ])('backsplash height: %s', (_label, backsplashHeight, invalid) => {
    const errors = validateCreatedOrder(
      validForm({ areas: [area('kitchen', 'k', { color: 'Serene', backsplashHeight })] }),
    );

    expect(Boolean(errors.areas.k?.backsplashHeight)).toBe(invalid);
  });

  it('counts header and area problems together', () => {
    const errors = validateCreatedOrder(
      validForm({ builder: '', areas: [area('kitchen', 'k'), area('island', 'i')] }),
    );

    expect(countErrors(errors)).toBe(3);
  });
});

describe('areaProgress', () => {
  it('counts the text inputs the kind shows, plus Faucet Spread', () => {
    // Kitchen: color, finish, edge, backsplashHeight, sinkModel, cooktopModel.
    expect(areaProgress(area('kitchen', 'k'))).toEqual({ filled: 0, total: 7 });
  });

  it('does not count inputs the kind does not have', () => {
    // Island has no Backsplash Height.
    expect(areaProgress(area('island', 'i')).total).toBe(6);
  });

  it('counts filled text and a faucet spread pick, but not blank-only text', () => {
    const progress = areaProgress(
      area('pantry', 'p', { color: 'Serene', finish: '   ', faucetSpread: ['C'] }),
    );

    expect(progress.filled).toBe(2);
  });
});

describe('stone copying', () => {
  it('copies Color, Finish and Edge and nothing else', () => {
    const source = area('kitchen', 'k', { color: 'Serene', finish: 'Polished', edge: 'Flat', sinkModel: 'S1' });
    const target = area('island', 'i', { sinkModel: 'S2', notes: 'keep me' });

    expect(copyStone(source, target)).toMatchObject({
      key: 'i',
      color: 'Serene',
      finish: 'Polished',
      edge: 'Flat',
      sinkModel: 'S2',
      notes: 'keep me',
    });
  });

  it('finds the first other area that has a Color', () => {
    const areas = [area('kitchen', 'k'), area('island', 'i', { color: 'Serene' }), area('pantry', 'p', { color: 'Ash' })];

    expect(stoneSource(areas, 'k')?.key).toBe('i');
    expect(stoneSource(areas, 'i')?.key).toBe('p');
  });

  it('offers no source when no other area has a Color', () => {
    expect(stoneSource([area('kitchen', 'k', { color: 'Serene' })], 'k')).toBeUndefined();
  });
});

describe('toCreatePayload', () => {
  it('trims text and drops client-only keys', () => {
    const payload = toCreatePayload(
      validForm({ builder: '  Highland Homes  ', areas: [area('pantry', 'p', { color: ' Serene ', name: ' Pantry ' })] }),
    );

    expect(payload.builder).toBe('Highland Homes');
    expect(payload.areas[0]).toMatchObject({ name: 'Pantry', color: 'Serene' });
    expect(payload.areas[0]).not.toHaveProperty('key');
  });

  it('resets values the area kind does not show', () => {
    // A Pantry has no Cooktop Model, Waterfall Qty, Pop-up Outlet, Half Wall or
    // Location — whatever is left on the draft must not reach the API.
    const payload = toCreatePayload(
      validForm({
        areas: [
          area('pantry', 'p', {
            color: 'Serene',
            cooktopModel: 'JGP5036',
            waterfallQty: 2,
            popUpOutlet: 1,
            halfWall: true,
            location: 'Window',
          }),
        ],
      }),
    );

    expect(payload.areas[0]).toMatchObject({
      cooktopModel: '',
      waterfallQty: 0,
      popUpOutlet: 0,
      halfWall: false,
      location: '',
    });
  });

  it('keeps the values a kind does show', () => {
    const payload = toCreatePayload(
      validForm({
        areas: [area('master_bath', 'm', { color: 'Cotton White', waterfallQty: 2, halfWall: true })],
      }),
    );

    expect(payload.areas[0]).toMatchObject({ waterfallQty: 2, halfWall: true });
  });

  it('orders Faucet Spread left to right and drops positions its row does not have', () => {
    // 'L12' is not on a bath's narrow row, so it is dropped.
    const payload = toCreatePayload(
      validForm({
        areas: [area('master_bath', 'm', { color: 'White', faucetSpread: ['R4', 'L12', 'C', 'L4'] })],
      }),
    );

    expect(payload.areas[0].faucetSpread).toEqual(['L4', 'C', 'R4']);
  });
});
