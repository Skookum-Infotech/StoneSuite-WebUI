import { describe, expect, it } from 'vitest';
import { BLOCKING_DUPLICATE_KINDS, documentRoutes } from './documentExtractionRoutes';
import type { DocumentExtractionDocType } from '@/types/documentExtraction';

describe('documentRoutes', () => {
  const cases: Array<[DocumentExtractionDocType, string, string, string, string]> = [
    ['sales_order', '/sales/sales_order', 'Sales Order', 'customer', 'order'],
    ['purchase_order', '/purchases/purchase_order', 'Purchase Order', 'vendor', 'purchase order'],
    ['vendor_bill', '/purchases/vendor_bill', 'Vendor Bill', 'vendor', 'vendor bill'],
  ];
  it.each(cases)('%s', (docType, base, label, party, manual) => {
    const r = documentRoutes(docType);
    expect(r.listPath).toBe(base);
    expect(r.newPath).toBe(`${base}/new`);
    expect(r.recordPath('abc')).toBe(`${base}/abc`);
    expect(r.fromDocumentPath('a b')).toBe(`${base}/new?fromDocument=a%20b`);
    expect(r.label).toBe(label);
    expect(r.partyLabel).toBe(party);
    expect(r.manualNoun).toBe(manual);
  });

  it('gates on same_invoice but not same_reference', () => {
    expect(BLOCKING_DUPLICATE_KINDS.has('same_invoice')).toBe(true);
    expect(BLOCKING_DUPLICATE_KINDS.has('same_reference')).toBe(false);
    expect(BLOCKING_DUPLICATE_KINDS.has('quote_reference')).toBe(false);
  });
});
