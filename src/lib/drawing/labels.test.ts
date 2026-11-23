import { describe, expect, it } from 'vitest';
import { areaLetter, nextPieceLabel, validatePieceLabel } from './labels';

describe('areaLetter', () => {
  it.each([[0, 'A'], [1, 'B'], [25, 'Z']])('maps area index %s to %s', (index, expected) => {
    expect(areaLetter(index)).toBe(expected);
  });
});

describe('nextPieceLabel', () => {
  it.each([
    ['A', [], 'A-1'],
    ['A', ['A-1'], 'A-2'],
    ['A', ['A-1', 'A-3'], 'A-2'],
    ['A', ['B-1'], 'A-1'],
  ])('next label for prefix %s given %j is %s', (prefix, existing, expected) => {
    expect(nextPieceLabel(prefix, existing)).toBe(expected);
  });
});

describe('validatePieceLabel', () => {
  it.each([
    ['', ['A-1'], undefined, 'Enter a label.'],
    ['A-1', ['A-1', 'A-2'], undefined, 'A-1 is already used in this area.'],
    ['a-1', ['A-1'], undefined, 'A-1 is already used in this area.'],
    ['A-1', ['A-1'], 'A-1', null],
    ['A-3', ['A-1', 'A-2'], undefined, null],
  ])('validates %j against %j (editing %j) as %j', (label, existing, excludeLabel, expected) => {
    expect(validatePieceLabel(label, existing, excludeLabel)).toBe(expected);
  });
});
