import { describe, it, expect } from 'vitest';
import { buildSalesOrderHandoff, parseMoney, taxReviewItem, toIsoDate } from './salesOrderDocumentHandoff';
import { f, item, line, match, resultDoc } from '@/test/documentExtractionFixtures';

const FILE = 'PO-4471.pdf';

describe('parseMoney', () => {
  it.each([
    ['$1,234.50', 1234.5], ['12', 12], ['(12.00)', -12], ['-3.5', -3.5], ['', null], ['abc', null],
  ])('%s -> %s', (raw, want) => expect(parseMoney(raw)).toBe(want));
});

describe('toIsoDate', () => {
  it.each([
    ['2026-09-01', '2026-09-01'], ['9/1/2026', '2026-09-01'], ['12-25-2026', '2026-12-25'],
    ['13/40/2026', ''], ['Sept first', ''],
  ])('%s -> %s', (raw, want) => expect(toIsoDate(raw)).toBe(want));
});

describe('buildSalesOrderHandoff', () => {
  it('maps header fields, provenance and the revision memo', () => {
    const h = buildSalesOrderHandoff(resultDoc({
      header: { poNumber: f('PO-9', { snippet: 'PO # PO-9', page: 1, row: 3 }), billTo: f('1 Main St\nDallas TX'), total: f('500.00') },
      paymentTerms: { id: 7, name: 'Net 30', code: 'N30' },
      extracted: { revision: { label: 'Revision 2', referencedNumber: 'SO-1042' } },
    }), FILE);
    expect(h.data).toMatchObject({
      purchase_doc_num: 'PO-9', date_created: '2026-09-01', payment_terms: '7',
      bill_address1: '1 Main St', bill_address2: 'Dallas TX',
    });
    expect(h.data.memo).toBe('Created from document PO-4471.pdf. Revision 2 (references SO-1042).');
    expect(h.provenance.poNumber).toMatchObject({ page: 1, row: 3, snippet: 'PO # PO-9' });
    expect(h.badges.revision).toBe('Revision 2');
  });

  it('splits document addresses into street, city, state id and zip', () => {
    const geo = {
      countries: [{ id: 1, code: 'US', name: 'United States of America' }],
      states: [{ id: 43, code: 'TX', name: 'Texas', countryId: 1 }],
    };
    const h = buildSalesOrderHandoff(resultDoc({
      header: {
        billTo: f('ACME Stone Inc\n12 Main Street\nDallas, TX 75201'),
        shipTo: f('ACME Stone - Plano Yard\n900 Quarry Road\nPlano, ZZ 75024'),
      },
    }), FILE, geo);
    expect(h.data).toMatchObject({
      bill_address1: '12 Main Street', bill_city: 'Dallas', bill_state: '43', bill_zip: '75201',
      ship_same_as_bill: false, ship_address1: '900 Quarry Road', ship_address2: 'ACME Stone - Plano Yard',
      ship_city: 'Plano', ship_zip: '75024',
    });
    expect(h.data.ship_state).toBeFalsy();
    expect(h.reviewItems).toContainEqual(expect.objectContaining({ key: 'shipTo', required: false }));
  });

  it('maps an unpriced order form: job notes in the memo, area details on the lines', () => {
    const h = buildSalesOrderHandoff(resultDoc({
      header: {
        poNumber: f(''), orderDate: f(''), total: f(''),
        shipTo: f('418 Willow Bend\nCelina 75009'),
        notes: f('Special instructions: NO POP-UP OUTLET\nBuilder contact: Dana Reyes'),
      },
      lines: [
        line({ description: f('CALACATTA LUX'), detail: 'Kitchen - Finish POLISHED', unitPrice: f(''), amount: f(''), unitPriceCents: 0, amountCents: 0 }),
        line({ description: f('MISTERIO'), detail: 'Island - Edge FLAT', unitPrice: f(''), amount: f(''), unitPriceCents: 0, amountCents: 0 }),
      ],
      matches: [match(0), match(1, { item: undefined, matchedBy: undefined })],
      extracted: { warnings: ['no_prices', 'missing_po_number'] },
    }), FILE);
    expect(h.data.memo).toBe('Created from document PO-4471.pdf.\n\nSpecial instructions: NO POP-UP OUTLET\nBuilder contact: Dana Reyes');
    expect(h.data).toMatchObject({ ship_address1: '418 Willow Bend', ship_city: 'Celina', ship_zip: '75009' });
    expect(h.reviewItems).toContainEqual(expect.objectContaining({ key: 'shipTo', reason: 'The document gives no state - pick the state.' }));
    expect(h.lineItems[0].itemDescription).toBe('CALACATTA LUX - Kitchen - Finish POLISHED');
    expect(h.lineItems[1]).toMatchObject({ itemName: 'MISTERIO', itemDescription: 'MISTERIO - Island - Edge FLAT' });
    expect(h.lines[1].docText).toContain('Island - Edge FLAT');
    expect(h.reviewItems).toContainEqual(expect.objectContaining({ key: 'document', required: false, reason: expect.stringContaining('no prices') }));
  });

  it('keeps the plain memo and descriptions for a priced PO', () => {
    const h = buildSalesOrderHandoff(resultDoc(), FILE);
    expect(h.data.memo).toBe('Created from document PO-4471.pdf.');
    expect(h.reviewItems.some((r) => r.reason.includes('no prices'))).toBe(false);
  });

  it('resolved customer needs no review; unresolved one is required with candidates', () => {
    const ok = buildSalesOrderHandoff(resultDoc(), FILE);
    expect(ok.customer.resolved).toEqual({ id: 'cust-1', name: 'ACME Stone' });
    expect(ok.reviewItems.filter((r) => r.key === 'customer')).toHaveLength(0);

    const bad = buildSalesOrderHandoff(resultDoc({
      customer: { uuid: undefined, name: undefined, confidence: 'not_found', candidates: [{ uuid: 'c2', name: 'Acme Stoneworks', active: true, score: 0.8 }] },
    }), FILE);
    expect(bad.customer.resolved).toBeNull();
    expect(bad.customer.extractedText).toBe('ACME Stone Inc');
    expect(bad.customer.candidates).toHaveLength(1);
    expect(bad.reviewItems.find((r) => r.key === 'customer')).toMatchObject({ required: true });
  });

  it('treats an inactive customer match as unresolved', () => {
    const h = buildSalesOrderHandoff(resultDoc({ customer: { active: false } }), FILE);
    expect(h.customer.resolved).toBeNull();
    expect(h.customer.inactive).toBe(true);
  });

  it('orders add-ons after their parent and labels them', () => {
    const lines = [
      line({ description: f('Slab A') }),
      line({ description: f('Slab B') }),
      line({ kind: 'addon', parentLine: 1, description: f('Edge polish') }),
    ];
    const h = buildSalesOrderHandoff(resultDoc({ lines, matches: [match(0), match(1), match(2)] }), FILE);
    expect(h.lines.map((l) => l.docDescription)).toEqual(['Slab A', 'Edge polish', 'Slab B']);
    expect(h.lines[1].parentLineNo).toBe(1);
    expect(h.lines[1].pills.map((p) => p.label)).toContain('Add-on to line 1');
    expect(h.lineItems.map((l) => l.lineNo)).toEqual([1, 2, 3]);
  });

  it('drops charge and note rows from the lines', () => {
    const h = buildSalesOrderHandoff(resultDoc({
      lines: [line(), line({ kind: 'charge' }), line({ kind: 'note' })], matches: [match(0)],
    }), FILE);
    expect(h.lines).toHaveLength(1);
  });

  it('matched line keeps the document qty and price and becomes a catalog line', () => {
    const h = buildSalesOrderHandoff(resultDoc({
      lines: [line({ qtyMilli: 2500, unitPriceCents: 5000 })], matches: [match(0, { source: 'learned' })],
    }), FILE);
    expect(h.lineItems[0]).toMatchObject({
      inventoryItemUuid: 'item-1', quantity: '2.5', unitPrice: '50.00', amount: '125.00', units: 'SQFT',
    });
    expect(h.lines[0].pills.map((p) => p.kind)).toEqual(['learned']);
    expect(h.lines[0].requiresItem).toBe(false);
  });

  it('unmatched line keeps the document text, requires an item and blocks Save', () => {
    const h = buildSalesOrderHandoff(resultDoc({
      lines: [line({ sku: f('ZZ-9'), description: f('Mystery stone') })], matches: [{ index: 0, flags: ['item_unmatched'] }],
    }), FILE);
    expect(h.lineItems[0].inventoryItemUuid).toBeUndefined();
    expect(h.lineItems[0].itemName).toBe('Mystery stone');
    expect(h.lines[0]).toMatchObject({ requiresItem: true, docText: 'ZZ-9 - Mystery stone' });
    expect(h.lines[0].pills.map((p) => p.kind)).toEqual(['pick_item']);
    expect(h.reviewItems.find((r) => r.key === 'line:1')).toMatchObject({ required: true });
  });

  it('inactive matched item must be re-picked', () => {
    const h = buildSalesOrderHandoff(resultDoc({ matches: [match(0, { item: item({ active: false }) })] }), FILE);
    expect(h.lines[0].requiresItem).toBe(true);
  });

  it('flags a document price that differs from the catalog', () => {
    const h = buildSalesOrderHandoff(resultDoc({
      lines: [line({ unitPriceCents: 6000 })], matches: [match(0)],
    }), FILE);
    expect(h.lineItems[0].unitPrice).toBe('60.00');
    expect(h.lines[0].pills.find((p) => p.kind === 'price_differs')?.label).toBe('Price ≠ catalog $50.00');
    expect(h.reviewItems.find((r) => r.key === 'line:1')).toMatchObject({ required: false });
  });

  it('uses converted qty/price and notes the conversion', () => {
    const h = buildSalesOrderHandoff(resultDoc({
      lines: [line({ qtyMilli: 10_000, unitPriceCents: 5400 })],
      matches: [match(0, { converted: { fromUom: 'sqm', toUom: 'SQFT', fromQtyMilli: 10_000, qtyMilli: 107_639, unitPriceCents: 5000 } })],
    }), FILE);
    expect(h.lineItems[0]).toMatchObject({ quantity: '107.639', unitPrice: '50.00' });
    expect(h.lines[0].conversionNote).toBe('Converted 10 sqm to 107.639 SQFT');
    expect(h.lines[0].pills.map((p) => p.kind)).toContain('converted');
    expect(h.badges.convertedUnits).toBe(true);
  });

  it('shipping is positive and a document discount becomes a negative adjustment', () => {
    const h = buildSalesOrderHandoff(resultDoc({ header: { shipping: f('$45.00'), discount: f('25.00') } }), FILE);
    expect(h.extras).toMatchObject({ shippingCharge: 45, adjustment: -25 });
    const neg = buildSalesOrderHandoff(resultDoc({ header: { discount: f('-25.00') } }), FILE);
    expect(neg.extras.adjustment).toBe(-25);
  });

  it('docTotal excludes document tax; badges report signed and wrong type', () => {
    const h = buildSalesOrderHandoff(resultDoc({
      header: { total: f('540.00'), tax: f('40.00') },
      extracted: { signed: true, warnings: ['document_looks_like_vendor_bill'] },
    }), FILE);
    expect(h.docTotal).toBe(500);
    expect(h.badges).toMatchObject({ signed: true, wrongType: 'vendor bill' });
  });

  it('flags low-confidence header fields as optional review items', () => {
    const h = buildSalesOrderHandoff(resultDoc({ header: { poNumber: f('P0-4471', { confidence: 'check' }) } }), FILE);
    expect(h.reviewItems.find((r) => r.key === 'poNumber')).toMatchObject({ required: false });
  });
});

describe('taxReviewItem', () => {
  it.each([
    { docTax: 0, subtotal: 2034.5, want: null },
    { docTax: -5, subtotal: 100, want: null },
    { docTax: 167.85, subtotal: 2034.5, want: 'The document charges $167.85 tax (about 8.25% of the subtotal). Set the lines\' Tax % so the order charges the same tax, then mark it reviewed.' },
    { docTax: 10, subtotal: null, want: 'The document charges $10.00 tax. Set the lines\' Tax % so the order charges the same tax, then mark it reviewed.' },
    { docTax: 10, subtotal: 0, want: 'The document charges $10.00 tax. Set the lines\' Tax % so the order charges the same tax, then mark it reviewed.' },
  ])('tax $docTax on subtotal $subtotal', ({ docTax, subtotal, want }) => {
    const item = taxReviewItem(docTax, subtotal);
    if (want === null) {
      expect(item).toBeNull();
      return;
    }
    expect(item).toEqual({ key: 'tax', label: 'Sales tax', required: true, resolvedByReview: true, reason: want });
  });
});
