import { describe, it, expect } from 'vitest';
import { buildCompleteInput, learnedCustomerNote } from './salesOrderReviewSave';
import type { HandoffLine } from './salesOrderDocumentHandoff';
import type { SOLineItem } from './salesOrderForm';

const lines = [
  { id: 'doc-line-0', docSku: 'A', docDescription: 'Slab' },
  { id: 'doc-line-1', docSku: 'B', docDescription: 'Edge' },
] as HandoffLine[];

describe('buildCompleteInput', () => {
  it('reports only document lines that ended with an item', () => {
    const out = buildCompleteInput('rec-1', { customerUuid: 'c', poNumber: 'P', orderDate: '2026-09-01' }, lines, [
      { id: 'doc-line-0', inventoryItemUuid: 'i-1' }, { id: 'doc-line-1' },
    ] as SOLineItem[]);
    expect(out).toEqual({
      recordUuid: 'rec-1',
      saved: { customerUuid: 'c', poNumber: 'P', orderDate: '2026-09-01', lines: [{ docSku: 'A', docDescription: 'Slab', itemUuid: 'i-1' }] },
    });
  });
});

describe('learnedCustomerNote', () => {
  const handoff = { customer: { resolved: { id: 'c1', name: 'ACME' }, extractedText: 'ACME Stone Inc', candidates: [], inactive: false } };
  it.each([
    [{ id: 'c2', name: 'ACME Stone' }, "We'll remember ACME Stone Inc → ACME Stone next time."],
    [{ id: 'c1', name: 'ACME' }, ''],
    [null, ''],
  ])('%j', (chosen, want) => expect(learnedCustomerNote(handoff, chosen)).toBe(want));
  it('is silent without document text', () => {
    expect(learnedCustomerNote({ customer: { ...handoff.customer, extractedText: '' } }, { id: 'x', name: 'X' })).toBe('');
  });
});
