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

  // The E2E bug: picking a customer left "Address 123 / Dallas 75063" from the
  // customer record mixed with the document's "Plano Yard" line 2.
  it('takes a document address block whole — no customer street or zip mixes in', () => {
    const merged = {
      bill_address1: 'Address 123', bill_suite: '9', bill_city: 'Dallas', bill_zip: '75063', bill_phone: '+1 555',
      ship_address1: 'Address 123', ship_address2: '', ship_city: 'Dallas', ship_zip: '75063', ship_same_as_bill: true,
    };
    const doc = {
      ...baseline,
      bill_address1: '12 Main Street', bill_city: 'Dallas', bill_zip: '75201',
      ship_address1: '900 Quarry Road', ship_address2: 'ACME Stone - Plano Yard', ship_city: 'Plano', ship_zip: '75024',
      ship_same_as_bill: false,
    };
    const out = overlayDocumentValues(merged, doc, { ...baseline, ship_same_as_bill: false });
    expect(out).toMatchObject({
      bill_address1: '12 Main Street', bill_suite: '', bill_zip: '75201', bill_phone: '+1 555',
      ship_address1: '900 Quarry Road', ship_address2: 'ACME Stone - Plano Yard', ship_city: 'Plano', ship_zip: '75024',
      ship_same_as_bill: false,
    });
  });

  it('keeps the customer address when the document had none', () => {
    const merged = { ship_address1: 'Address 123', ship_zip: '75063' };
    const out = overlayDocumentValues(merged, { ...baseline }, baseline);
    expect(out).toMatchObject({ ship_address1: 'Address 123', ship_zip: '75063' });
  });
});
