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
  toFormState,
  validateCreatedOrder,
} from './createdOrderForm';
import type { AreaDraft, CreatedOrderFormState } from './createdOrderForm';
import type { AreaKind, CreatedOrder } from '@/types/createdOrder';

const VALID_PHONE = '+1 480 209 5330';

// A fixed "today", so the past-date rule does not depend on when the suite runs.
const NOW = new Date(2026, 9, 1, 12, 0, 0);
const validate = (form: CreatedOrderFormState) => validateCreatedOrder(form, NOW);

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

  it('skips a number a removed area left taken', () => {
    // Bath and Bath 2 were added, then Bath was removed.
    const existing = [area('bath', 'b2', { name: 'Bath 2' })];

    expect(defaultAreaName('bath', existing)).toBe('Bath 3');
  });

  it('does not reuse the plain label when another area was named that', () => {
    const existing = [area('custom', 'c1', { name: ' bath ' })];

    expect(defaultAreaName('bath', existing)).toBe('Bath 2');
  });
});

describe('validateCreatedOrder area names', () => {
  it('flags every repeatable area that shares a name', () => {
    const errors = validate(
      validForm({
        areas: [
          area('custom', 'a', { name: 'Wine Bar', color: 'White' }),
          area('custom', 'b', { name: ' wine   bar ', color: 'White' }),
          area('custom', 'c', { name: 'Deck', color: 'White' }),
        ],
      }),
    );

    expect(errors.areas.a?.name).toMatch(/already has this name/i);
    expect(errors.areas.b?.name).toMatch(/already has this name/i);
    expect(errors.areas.c).toBeUndefined();
  });

  it('flags the repeatable area, not the single-use one it collides with', () => {
    const errors = validate(
      validForm({
        areas: [
          area('custom', 'a', { name: 'Kitchen', color: 'White' }),
          area('kitchen', 'k', { color: 'White' }),
        ],
      }),
    );

    expect(errors.areas.a?.name).toMatch(/already has this name/i);
    expect(errors.areas.k).toBeUndefined();
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
    const errors = validate(validForm());

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
    const errors = validate(validForm({ [field]: '   ' }));

    expect(errors.header[field]).toMatch(/required/i);
  });

  it.each(['plan', 'specialInstructions'] as const)('treats %s as optional', (field) => {
    const errors = validate(validForm({ [field]: '' }));

    expect(errors.header[field]).toBeUndefined();
  });

  it.each([
    ['a number that is not dialable', '123', true],
    ['letters', 'call me', true],
    ['a valid number', VALID_PHONE, false],
  ])('phone: %s', (_label, phone, invalid) => {
    const errors = validate(validForm({ phone }));

    expect(Boolean(errors.header.phone)).toBe(invalid);
  });

  it.each([
    ['no @', 'nope', true],
    ['no domain dot', 'a@b', true],
    ['a plain address', 'a@b.co', false],
  ])('email: %s', (_label, email, invalid) => {
    const errors = validate(validForm({ email }));

    expect(Boolean(errors.header.email)).toBe(invalid);
  });

  it.each([
    ['install before measure', '2026-10-06', '2026-10-05', true],
    ['install on the measure day', '2026-10-06', '2026-10-06', false],
    ['install after measure', '2026-10-06', '2026-10-19', false],
  ])('dates: %s', (_label, measureDate, installDate, invalid) => {
    const errors = validate(validForm({ measureDate, installDate }));

    expect(Boolean(errors.header.installDate)).toBe(invalid);
  });

  it.each([
    ['today', '2026-10-01', false],
    ['tomorrow', '2026-10-02', false],
    ['yesterday', '2026-09-30', true],
  ])('install date: %s', (_label, installDate, past) => {
    const errors = validate(validForm({ measureDate: '2026-09-28', installDate }));

    expect(errors.header.installDate === 'Install Date cannot be in the past.').toBe(past);
  });

  it('does not stack an ordering error on a missing Measure Date', () => {
    const errors = validate(validForm({ measureDate: '' }));

    expect(errors.header.measureDate).toMatch(/required/i);
    expect(errors.header.installDate).toBeUndefined();
  });

  it('asks for at least one area', () => {
    const errors = validate(validForm({ areas: [] }));

    expect(errors.noAreas).toBeDefined();
    expect(countErrors(errors)).toBe(1);
  });

  it('requires a Color on every area and reports it against that area', () => {
    const errors = validate(
      validForm({ areas: [area('kitchen', 'k', { color: 'Serene' }), area('island', 'i')] }),
    );

    expect(errors.areas).toEqual({ i: { color: 'Color is required.' } });
  });

  it('requires a name on a Bath or Custom area', () => {
    const errors = validate(validForm({ areas: [area('bath', 'b', { color: 'White', name: '  ' })] }));

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
    const errors = validate(
      validForm({ areas: [area('kitchen', 'k', { color: 'Serene', backsplashHeight })] }),
    );

    expect(Boolean(errors.areas.k?.backsplashHeight)).toBe(invalid);
  });

  it('counts header and area problems together', () => {
    const errors = validate(
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

describe('validateCreatedOrder — an order being changed', () => {
  const past = validForm({ measureDate: '2026-09-01', installDate: '2026-09-10' });

  it('accepts the install date the order already has, even once it has passed', () => {
    expect(validateCreatedOrder(past, NOW, '2026-09-10').header.installDate).toBeUndefined();
  });

  it('still refuses a different install date in the past', () => {
    const moved = { ...past, installDate: '2026-09-11' };

    expect(validateCreatedOrder(moved, NOW, '2026-09-10').header.installDate).toBe(
      'Install Date cannot be in the past.',
    );
  });

  it('holds a new order to the rule, there being no stored date to keep', () => {
    expect(validateCreatedOrder(past, NOW).header.installDate).toBe('Install Date cannot be in the past.');
  });
});

describe('toFormState', () => {
  const saved: CreatedOrder = {
    id: 'o1',
    status: 'submitted',
    editable: true,
    createdAt: '2026-10-12T15:30:00Z',
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
    specialInstructions: 'Gate code 1234.',
    areas: [
      {
        kind: 'kitchen', name: 'Kitchen', color: 'Serene', finish: '', edge: 'Flat', backsplashHeight: '4',
        sinkModel: '440185', cooktopModel: '', waterfallQty: 2, popUpOutlet: 0, halfWall: false,
        location: '', faucetSpread: ['L8', 'C'], notes: 'Seam at the window.',
      },
      {
        kind: 'bath', name: 'Guest Bath', color: 'Ash', finish: '', edge: '', backsplashHeight: '',
        sinkModel: '', cooktopModel: '', waterfallQty: 0, popUpOutlet: 0, halfWall: false,
        location: '', faucetSpread: [], notes: '',
      },
    ],
  };

  it('sends back exactly what was saved when nothing is changed', () => {
    const { id, status, editable, createdAt, ...input } = saved;
    void [id, status, editable, createdAt];

    expect(toCreatePayload(toFormState(saved))).toEqual(input);
  });

  it('gives every area its own client key, none of which can clash with a new area', () => {
    const keys = toFormState(saved).areas.map((area) => area.key);

    expect(new Set(keys).size).toBe(2);
    expect(keys.every((key) => !key.startsWith('area-'))).toBe(true);
  });

  it('does not share the faucet spread with the saved order', () => {
    const form = toFormState(saved);

    form.areas[0].faucetSpread.push('R8');

    expect(saved.areas[0].faucetSpread).toEqual(['L8', 'C']);
  });

  it('is valid as it came back, so Save changes needs no edits', () => {
    const errors = validateCreatedOrder(toFormState(saved), NOW, saved.installDate);

    expect(countErrors(errors)).toBe(0);
  });
});
