import { describe, expect, it } from 'vitest';
import { areaCountLabel, cityZipLabel, orderStatusLabel } from './createdOrderDisplay';

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
