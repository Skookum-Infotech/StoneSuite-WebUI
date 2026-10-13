import { describe, it, expect } from 'vitest';
import { buildPurchaseOrderHandoff } from './purchaseOrderDocumentHandoff';
import { MAX_FREE_TEXT_LINE_CHARS } from './purchaseDocumentShared';
import { f, line, match } from '@/test/documentExtractionFixtures';
import { vendorDoc } from '@/test/purchaseDocFixtures';
import type { HandoffGeo } from './documentAddress';

const GEO: HandoffGeo = {
  countries: [{ id: 1, name: 'United States', code: 'US' }],
  states: [{ id: 44, name: 'Texas', code: 'TX', countryId: 1 }],
} as unknown as HandoffGeo;

const reasons = (h: ReturnType<typeof buildPurchaseOrderHandoff>, key?: string): string[] =>
  h.reviewItems.filter((i) => !key || i.key === key).map((i) => i.reason);

describe('buildPurchaseOrderHandoff', () => {
  it('maps a vendor quote onto the PO form and resolves the vendor', () => {
    const h = buildPurchaseOrderHandoff(vendorDoc({
      header: { poNumber: f('Q-778'), orderDate: f('09/02/2026'), deliveryDate: f('2026-09-20'), notes: f('Call before delivery') },
      paymentTerms: { id: 3, name: 'Net 30', code: 'N30' },
    }), 'quote.pdf', GEO);
    expect(h.vendor.resolved).toEqual({ id: 'ven-1', name: 'Marble Supply Co' });
    expect(h.data).toMatchObject({ reference_number: 'Q-778', order_date: '2026-09-02', expected_date: '2026-09-20', payment_terms: '3' });
    expect(String(h.data.memo)).toContain('Created from document quote.pdf.');
    expect(String(h.data.memo)).toContain('Call before delivery');
    expect(h.provenance.paymentTerms.source).toBe('catalog');
    expect(h.lineItems[0]).toMatchObject({ quantity: '10', unitPrice: '50.00', inventoryItemUuid: 'item-1' });
  });

  it('requires a vendor pick when none matched and when the match is inactive', () => {
    const none = buildPurchaseOrderHandoff(vendorDoc({ vendor: null }), 'a.pdf', GEO);
    expect(none.vendor.resolved).toBeNull();
    expect(none.reviewItems).toContainEqual(expect.objectContaining({ key: 'vendor', required: true, reason: 'Vendor not matched - pick one.' }));
    const inactive = buildPurchaseOrderHandoff(vendorDoc({ vendor: { active: false } }), 'a.pdf', GEO);
    expect(inactive.vendor.resolved).toBeNull();
    expect(inactive.vendor.inactive).toBe(true);
    expect(reasons(inactive, 'vendor')[0]).toContain('not active');
  });

  it('flags an order form: no prices, ship-to city/zip without a state, notes into the memo, detail in the description', () => {
    const h = buildPurchaseOrderHandoff(vendorDoc({
      vendor: null,
      header: { shipTo: f('12 Oak Lane\nCelina 75009'), notes: f('Builder: Acme Homes') },
      extracted: { warnings: ['no_prices'], classifiedAs: 'order_form' },
      lines: [line({ detail: 'Eased edge, 1 cutout', unitPrice: f(), unitPriceCents: 0, amount: f(), amountCents: 0 })],
    }), 'order.pdf', GEO);
    expect(reasons(h, 'document')).toContain('This order form has no prices - set the price on each line.');
    expect(reasons(h, 'shipTo')).toContain('The document gives no state - pick the state.');
    expect(h.data).toMatchObject({ ship_address1: '12 Oak Lane', ship_city: 'Celina', ship_zip: '75009' });
    expect(h.data.ship_state).toBeUndefined();
    expect(String(h.data.memo)).toContain('Builder: Acme Homes');
    expect(h.lineItems[0].itemDescription).toContain('Eased edge, 1 cutout');
    expect(h.vendor.resolved).toBeNull();
  });

  it('resolves a printed ship-to state to its id', () => {
    const h = buildPurchaseOrderHandoff(vendorDoc({ header: { shipTo: f('1 Dock Rd\nPlano, TX 75024') } }), 'a.pdf', GEO);
    expect(h.data.ship_state).toBe('44');
  });

  it('does not compare the vendor price with the catalog sales price', () => {
    const h = buildPurchaseOrderHandoff(vendorDoc({ lines: [line({ unitPriceCents: 3000 })] }), 'a.pdf', GEO);
    expect(h.lines[0].pills.map((p) => p.kind)).not.toContain('price_differs');
  });

  it.each([
    { name: 'free-text line is shortened with a review item', matched: false, long: 400, cut: true },
    { name: 'catalog line keeps its full description', matched: true, long: 400, cut: false },
    { name: 'short free-text line is untouched', matched: false, long: 20, cut: false },
  ])('$name', ({ matched, long, cut }) => {
    const text = 'x'.repeat(long);
    const h = buildPurchaseOrderHandoff(vendorDoc({
      lines: [line({ description: f(text) })], matches: matched ? [match(0)] : [],
    }), 'a.pdf', GEO);
    const desc = h.lineItems[0].itemDescription;
    expect(desc.length).toBe(cut ? MAX_FREE_TEXT_LINE_CHARS : long);
    expect(reasons(h, 'line:1').some((r) => r.includes('shortened'))).toBe(cut);
  });

  it('shows a customer PO on the PO page as a warning with a Sales Orders link', () => {
    const h = buildPurchaseOrderHandoff(vendorDoc({ extracted: { warnings: ['looks_like_customer_po'] } }), 'a.pdf', GEO);
    const item = h.reviewItems.find((i) => i.link);
    expect(item?.reason).toContain("customer's purchase order");
    expect(item?.link?.to).toBe('/sales/sales_order');
    expect(item?.required).toBe(false);
    expect(h.badges.wrongType).toBe("customer's purchase order");
  });

  it('requires a tax check when the document charges tax, and carries shipping / discount into the form', () => {
    const h = buildPurchaseOrderHandoff(vendorDoc({
      header: { tax: f('41.25'), subtotal: f('500.00'), total: f('541.25'), shipping: f('25.00'), discount: f('10.00') },
    }), 'a.pdf', GEO);
    expect(h.docTotal).toBe(500);
    expect(h.data).toMatchObject({ shipping_charge: '25.00', adjustment: '-10.00' });
    expect(h.reviewItems).toContainEqual(expect.objectContaining({ key: 'tax', required: true, resolvedByReview: true }));
  });

  it('says so when the file is not a purchase order at all', () => {
    const h = buildPurchaseOrderHandoff(vendorDoc({ lines: [], extracted: { warnings: ['document_not_recognized'] } }), 'a.pdf', GEO);
    expect(h.badges.notRecognized).toBe(true);
    expect(h.badges.notRecognizedLabel).toBe('Not a purchase order?');
    expect(h.lineItems).toEqual([]);
  });
});
