import { describe, expect, it } from 'vitest';
import {
  areaCountLabel,
  areaDetailRows,
  cityZipLabel,
  faucetSpreadText,
  orderStatusLabel,
} from './createdOrderDisplay';
import type { AreaKind, CreatedOrderArea, FaucetSpreadPosition } from '@/types/createdOrder';

describe('orderStatusLabel', () => {
  it.each([
    ['submitted', 'Submitted'],
    ['pending_review', 'Pending review'],
    ['IN-PROGRESS', 'In progress'],
    ['', 'Submitted'],
    ['   ', 'Submitted'],
  ])('%j → %j', (status, expected) => {
    expect(orderStatusLabel(status)).toBe(expected);
  });
});

describe('areaCountLabel', () => {
  it.each([
    [0, '0 areas'],
    [1, '1 area'],
    [2, '2 areas'],
  ])('%d → %s', (count, expected) => {
    expect(areaCountLabel(count)).toBe(expected);
  });
});

describe('cityZipLabel', () => {
  it.each([
    ['Aubrey', '76227', 'Aubrey, 76227'],
    ['Aubrey', '', 'Aubrey'],
    ['', '76227', '76227'],
    ['  ', '  ', ''],
  ])('%j + %j → %j', (city, zip, expected) => {
    expect(cityZipLabel(city, zip)).toBe(expected);
  });
});

describe('faucetSpreadText', () => {
  it.each<[string, AreaKind, FaucetSpreadPosition[], string]>([
    ['reads left to right along the wide row', 'kitchen', ['R8', 'C', 'L8'], '8" left, Centre, 8" right'],
    ['uses the narrow row for a bath', 'bath', ['R2', 'L4'], '4" left, 2" right'],
    ['is empty when nothing is ticked', 'kitchen', [], ''],
    ['ignores a position the row does not print', 'master_bath', ['L12', 'C'], 'Centre'],
  ])('%s', (_label, kind, positions, expected) => {
    expect(faucetSpreadText(kind, positions)).toBe(expected);
  });
});

describe('areaDetailRows', () => {
  const base: CreatedOrderArea = {
    kind: 'kitchen',
    name: 'Kitchen',
    color: 'Serene',
    finish: '',
    edge: ' Flat ',
    backsplashHeight: '4',
    sinkModel: '',
    cooktopModel: 'CT-36',
    waterfallQty: 2,
    popUpOutlet: 0,
    halfWall: false,
    location: '',
    faucetSpread: ['C'],
    notes: '',
  };

  it('lists every input the kind has, in form order, with dashes for blanks', () => {
    expect(areaDetailRows(base)).toEqual([
      { label: 'Color', value: 'Serene' },
      { label: 'Finish', value: '—' },
      { label: 'Edge', value: 'Flat' },
      { label: 'Backsplash Height', value: '4 in' },
      { label: 'Sink Model', value: '—' },
      { label: 'Cooktop Model', value: 'CT-36' },
      { label: 'Waterfall Qty', value: '2' },
      { label: 'Faucet Spread', value: 'Centre' },
    ]);
  });

  it('shows Half Wall as Yes or No only where the kind has it', () => {
    const bath: CreatedOrderArea = { ...base, kind: 'master_bath', halfWall: true, faucetSpread: [] };
    const rows = areaDetailRows(bath);

    expect(rows.find((r) => r.label === 'Half Wall')?.value).toBe('Yes');
    expect(rows.find((r) => r.label === 'Faucet Spread')?.value).toBe('—');
    expect(areaDetailRows(base).some((r) => r.label === 'Half Wall')).toBe(false);
  });
});
