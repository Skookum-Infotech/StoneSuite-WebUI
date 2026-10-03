import { describe, it, expect } from 'vitest';
import {
  blockingItems, confirmableKeys, pendingReviewItems, reconcileTotals, reviewProgress, saveBlockedReason,
  visiblePills, type ReviewContext,
} from './documentReviewState';
import type { HandoffLine, ProvenanceInfo, ReviewItem } from './salesOrderDocumentHandoff';

const items: ReviewItem[] = [
  { key: 'customer', label: 'Customer', reason: 'pick', required: true },
  { key: 'line:1', label: 'Line 1', reason: 'pick item', required: true },
  { key: 'line:1', label: 'Line 1', reason: 'price differs', required: false },
  { key: 'poNumber', label: 'PO number', reason: 'check', required: false },
];
const ctx = (over: Partial<ReviewContext> = {}): ReviewContext => ({
  hasCustomer: false, lineHasItem: () => false, reviewed: new Set(), ...over,
});

describe('pendingReviewItems', () => {
  it('dedupes by key, joins reasons, keeps required', () => {
    const p = pendingReviewItems(items, ctx());
    expect(p.map((i) => i.key)).toEqual(['customer', 'line:1', 'poNumber']);
    expect(p[1]).toMatchObject({ required: true, reason: 'pick item price differs' });
  });
  it('resolves required items from the live form, optional ones from reviewed', () => {
    const p = pendingReviewItems(items, ctx({ hasCustomer: true, lineHasItem: () => true, reviewed: new Set(['poNumber']) }));
    // line:1's optional price check is still unreviewed
    expect(p.map((i) => i.key)).toEqual(['line:1']);
    expect(p[0].required).toBe(false);
  });
});

describe('saveBlockedReason', () => {
  it.each([[0, ''], [1, '1 required item to review'], [2, '2 required items to review']])('%i blocking -> %s', (n, want) => {
    const pending = Array.from({ length: n }, (_, i) => ({ key: `k${i}`, label: '', reason: '', required: true }));
    expect(saveBlockedReason(pending)).toBe(want);
  });
  it('ignores optional items', () => {
    expect(blockingItems([{ key: 'a', label: '', reason: '', required: false }])).toHaveLength(0);
  });
});

describe('confirmableKeys / reviewProgress', () => {
  const prov: Record<string, ProvenanceInfo> = {
    customer: { source: 'document', confidence: 'high' },
    poNumber: { source: 'document', confidence: 'check' },
    orderDate: { source: 'document', confidence: 'high' },
    'line:1': { source: 'document', confidence: 'high' },
  };
  it('confirms only high-confidence, unflagged keys', () => {
    expect(confirmableKeys(prov, items)).toEqual(['orderDate']);
  });
  it('counts reviewed and required-resolved keys', () => {
    const r = reviewProgress(prov, items, ctx({ hasCustomer: true, reviewed: new Set(['orderDate']) }));
    expect(r).toEqual({ done: 2, total: 4 });
  });
});

describe('reconcileTotals', () => {
  const lines = [
    { id: 'a', lineNo: 1, docAmount: 100 }, { id: 'b', lineNo: 2, docAmount: 200 },
  ] as HandoffLine[];
  it('ok when totals agree', () => {
    expect(reconcileTotals(300, 300, lines, new Map([['a', 100], ['b', 200]]))).toEqual({ ok: true, diff: 0 });
  });
  it('points at the line that differs most', () => {
    const r = reconcileTotals(300, 312.4, lines, new Map([['a', 100], ['b', 212.4]]));
    expect(r).toEqual({ ok: false, diff: 12.4, suspectLine: 2 });
  });
  it('off without a suspect when line amounts match (e.g. shipping)', () => {
    expect(reconcileTotals(300, 345, lines, new Map([['a', 100], ['b', 200]]))).toMatchObject({ ok: false, suspectLine: undefined });
  });
});

describe('visiblePills', () => {
  const meta = { requiresItem: true, pills: [{ kind: 'pick_item', label: 'Pick item' }] } as HandoffLine;
  it('shows Pick item until an item is chosen', () => {
    expect(visiblePills(meta, false, null, 50).map((p) => p.kind)).toEqual(['pick_item']);
  });
  it('becomes Matched, plus a price flag when the picked catalog price differs', () => {
    expect(visiblePills(meta, true, 40, 50).map((p) => p.kind)).toEqual(['matched', 'price_differs']);
    expect(visiblePills(meta, true, 50, 50).map((p) => p.kind)).toEqual(['matched']);
  });
});
