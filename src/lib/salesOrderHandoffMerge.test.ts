import { describe, it, expect } from 'vitest';
import { overlayDocumentValues } from './salesOrderHandoffMerge';

describe('overlayDocumentValues', () => {
  const baseline = { sales_order_status: 'Draft', sales_tax_pct: '0' };
  const cases = [
    {
      name: 'document-supplied values win over customer defaults',
      merged: { payment_terms: 'net-30', ship_address1: 'Customer St', sales_tax_pct: '7' },
      doc: { ...baseline, payment_terms: 'net-15', ship_address1: 'Dock 4' },
      want: { payment_terms: 'net-15', ship_address1: 'Dock 4', sales_tax_pct: '7', sales_order_status: undefined },
    },
    {
      name: 'values the document left at their defaults do not clobber customer defaults',
      merged: { sales_tax_pct: '7', payment_terms: 'net-30' },
      doc: { ...baseline },
      want: { sales_tax_pct: '7', payment_terms: 'net-30' },
    },
    {
      name: 'empty document values are ignored',
      merged: { payment_terms: 'net-30' },
      doc: { ...baseline, payment_terms: '' },
      want: { payment_terms: 'net-30' },
    },
  ];
  it.each(cases)('$name', ({ merged, doc, want }) => {
    const out = overlayDocumentValues(merged, doc, baseline);
    Object.entries(want).forEach(([k, v]) => {
      if (v !== undefined) expect(out[k]).toBe(v);
    });
    expect(out).not.toBe(merged);
  });
});
