import type {
  DocumentExtraction,
  ExtractedField,
  ExtractedLine,
  ExtractionResultDoc,
  ItemInfo,
  LineMatch,
} from '@/types/documentExtraction';

/** Test-only builders for extraction results (mirrors docextract / docextractjob JSON). */
export function f(value = '', over: Partial<ExtractedField> = {}): ExtractedField {
  return { value, source: 'document', confidence: value ? 'high' : 'not_found', ...over };
}

export function item(over: Partial<ItemInfo> = {}): ItemInfo {
  return {
    uuid: 'item-1', name: 'Quartz Slab', sku: 'QZ-3CM', unitCode: 'SQFT', unitCategory: 'area',
    catalogPriceCents: 5000, active: true, ...over,
  };
}

export function line(over: Partial<ExtractedLine> = {}): ExtractedLine {
  return {
    kind: 'product', sku: f('QZ-3CM'), description: f('Quartz slab 3cm'), uom: f('SQFT'), qty: f('10'),
    unitPrice: f('50.00'), amount: f('500.00'), qtyMilli: 10_000, unitPriceCents: 5000, amountCents: 50_000, ...over,
  };
}

export function match(index: number, over: Partial<LineMatch> = {}): LineMatch {
  return { index, item: item(), matchedBy: 'sku', source: 'catalog', ...over };
}

export function resultDoc(over: {
  lines?: ExtractedLine[]; matches?: LineMatch[]; header?: Partial<ExtractionResultDoc['extracted']['header']>;
  customer?: Partial<ExtractionResultDoc['resolution']['customer']>; extracted?: Partial<ExtractionResultDoc['extracted']>;
  paymentTerms?: ExtractionResultDoc['resolution']['paymentTerms'];
} = {}): ExtractionResultDoc {
  const empty = f();
  return {
    extracted: {
      docType: 'sales_order',
      header: {
        poNumber: f('PO-4471'), orderDate: f('2026-09-01'), deliveryDate: empty, customerName: f('ACME Stone Inc'),
        billTo: empty, shipTo: empty, paymentTerms: empty, subtotal: empty, tax: empty, shipping: empty,
        discount: empty, total: f('500.00'), currency: empty, ...over.header,
      },
      lines: over.lines ?? [line()],
      signed: false, restricted: false,
      pages: [{ page: 1, rows: [{ y: 700, words: [{ x: 10, w: 40, text: 'PO-4471' }] }] }],
      ...over.extracted,
    },
    resolution: {
      customer: { uuid: 'cust-1', name: 'ACME Stone', active: true, confidence: 'high', source: 'document', ...over.customer },
      paymentTerms: over.paymentTerms,
      lines: over.matches ?? [match(0)],
    },
    duplicates: [],
  };
}

export function extraction(result: ExtractionResultDoc | undefined, over: Partial<DocumentExtraction> = {}): DocumentExtraction {
  return {
    id: 'ex-1', docType: 'sales_order', status: 'ready', fileName: 'PO-4471.pdf', sizeBytes: 10, method: 'parser+llm',
    result, createdAt: '2026-09-01T00:00:00Z', expiresAt: '2026-09-02T00:00:00Z', ...over,
  };
}
