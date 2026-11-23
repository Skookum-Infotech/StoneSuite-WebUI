import { describe, it, expect } from 'vitest';
import { duplicateDialogCopy, findDuplicateMatch, type DuplicateCandidate } from './duplicateRecordCheck';

const CANDIDATES: DuplicateCandidate[] = [
  { id: '1', name: 'Acme Corp', isUsable: true },
  { id: '2', name: 'Acme Stone Supply', isUsable: false },
];

describe('findDuplicateMatch', () => {
  it('returns null when no candidate matches', () => {
    expect(findDuplicateMatch(CANDIDATES, 'Zenith')).toBeNull();
  });

  it('returns null for a blank entered name', () => {
    expect(findDuplicateMatch(CANDIDATES, '   ')).toBeNull();
  });

  it('returns null for a substring match that is not exact', () => {
    expect(findDuplicateMatch(CANDIDATES, 'Acme')).toBeNull();
  });

  it.each([
    ['Acme Corp', 'Acme Corp'],
    ['acme corp', 'Acme Corp'],
    ['  Acme Corp  ', 'Acme Corp'],
    ['ACME CORP', 'Acme Corp'],
  ])('matches case/whitespace-insensitively: %s', (entered, expectedName) => {
    const match = findDuplicateMatch(CANDIDATES, entered);
    expect(match?.candidate.name).toBe(expectedName);
  });

  it('classifies a usable candidate as active', () => {
    expect(findDuplicateMatch(CANDIDATES, 'Acme Corp')?.status).toBe('active');
  });

  it('classifies a non-usable candidate as reactivatable', () => {
    expect(findDuplicateMatch(CANDIDATES, 'Acme Stone Supply')?.status).toBe('reactivatable');
  });

  it('returns no candidates untouched (empty list)', () => {
    expect(findDuplicateMatch([], 'Acme Corp')).toBeNull();
  });
});

describe('duplicateDialogCopy', () => {
  it('offers to activate a reactivatable customer', () => {
    const copy = duplicateDialogCopy('customer', 'reactivatable', 'Acme Corp', 'Draft');
    expect(copy.showActivate).toBe(true);
    expect(copy.body).toContain('Acme Corp');
    expect(copy.body).toContain('Draft');
    expect(copy.body).toMatch(/Activate it and use it/);
  });

  it('offers to activate a reactivatable vendor', () => {
    const copy = duplicateDialogCopy('vendor', 'reactivatable', 'Acme Stone Supply', 'Inactive');
    expect(copy.showActivate).toBe(true);
    expect(copy.body).toContain('Acme Stone Supply');
    expect(copy.body).toContain('Inactive');
  });

  it('never offers to activate an item — no activation endpoint exists yet', () => {
    const copy = duplicateDialogCopy('item', 'reactivatable', 'Quartz Slab', 'Inactive');
    expect(copy.showActivate).toBe(false);
    expect(copy.body).toMatch(/isn't available yet/);
    expect(copy.body).toContain('Quartz Slab');
  });

  it.each([
    ['customer', 'Active'],
    ['vendor', 'Active'],
    ['item', 'Active'],
  ] as const)('blocks an already-active %s with no activate action', (entity, statusLabel) => {
    const copy = duplicateDialogCopy(entity, 'active', 'Acme Corp', statusLabel);
    expect(copy.showActivate).toBe(false);
    expect(copy.body).toContain('Acme Corp');
    expect(copy.body).toMatch(/already exists and is Active/);
  });
});
