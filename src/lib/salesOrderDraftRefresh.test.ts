import { describe, it, expect } from 'vitest';
import { fillDraftGaps } from './salesOrderDraftRefresh';
import { buildSalesOrderHandoff } from './salesOrderDocumentHandoff';
import type { ReviewForm } from '@/hooks/salesOrderReviewTypes';
import { resultDoc } from '@/test/documentExtractionFixtures';

const handoff = buildSalesOrderHandoff(resultDoc(), 'po.pdf');
const freshLine = handoff.lineItems[0];

function draft(over: Partial<ReviewForm> = {}): ReviewForm {
  const bare = { ...freshLine, inventoryItemUuid: undefined, itemName: 'Quartz slab 3cm', itemSku: '', units: '' };
  return { data: { memo: 'kept' }, customFieldValues: {}, customer: null, lineItems: [bare], ...over };
}

describe('fillDraftGaps', () => {
  it.each([
    { name: 'empty customer takes the fresh match', d: draft(), want: 'cust-1' },
    { name: 'a picked customer is kept', d: draft({ customer: { id: 'cust-9', name: 'Other' } }), want: 'cust-9' },
  ])('$name', ({ d, want }) => {
    expect(fillDraftGaps(d, handoff).customer?.id).toBe(want);
  });

  it.each([
    { name: 'item-less, unedited line takes the fresh item', edit: {}, want: freshLine.inventoryItemUuid },
    { name: 'edited quantity is left alone', edit: { quantity: '99' }, want: undefined },
    { name: 'edited price is left alone', edit: { unitPrice: '1.00' }, want: undefined },
    { name: 'a picked item is kept', edit: { inventoryItemUuid: 'item-9' }, want: 'item-9' },
  ])('$name', ({ edit, want }) => {
    const d = draft();
    d.lineItems = [{ ...d.lineItems[0], ...edit }];
    expect(fillDraftGaps(d, handoff).lineItems[0].inventoryItemUuid).toBe(want);
  });

  it('keeps the rest of the draft untouched', () => {
    const out = fillDraftGaps(draft(), handoff);
    expect(out.data).toEqual({ memo: 'kept' });
    expect(out.lineItems[0]).toMatchObject({ quantity: freshLine.quantity, units: freshLine.units, itemSku: freshLine.itemSku });
  });
});
