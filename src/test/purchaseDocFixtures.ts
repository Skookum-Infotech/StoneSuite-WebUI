import type {
  ExtractedHeader, ExtractedResult, ExtractionResolution, ExtractionResultDoc, LinkedPurchaseOrder,
} from '@/types/documentExtraction';
import { resultDoc } from './documentExtractionFixtures';

/** Test-only builders for purchase-order / vendor-bill extraction results. */
interface VendorDocOver {
  docType?: 'purchase_order' | 'vendor_bill';
  header?: Partial<ExtractedHeader>;
  extracted?: Partial<ExtractedResult>;
  vendor?: Partial<NonNullable<ExtractionResolution['vendor']>> | null;
  linkedPurchaseOrder?: LinkedPurchaseOrder;
  lines?: ExtractedResult['lines'];
  matches?: ExtractionResolution['lines'];
  paymentTerms?: ExtractionResolution['paymentTerms'];
}

/** A ready vendor-side extraction: vendor "Marble Supply Co" resolved unless `vendor: null`. */
export function vendorDoc(over: VendorDocOver = {}): ExtractionResultDoc {
  const doc = resultDoc({
    header: over.header as never, extracted: { docType: over.docType ?? 'purchase_order', ...over.extracted },
    lines: over.lines, matches: over.matches, paymentTerms: over.paymentTerms,
  });
  doc.resolution.vendor = over.vendor === null
    ? { active: false, confidence: 'not_found', source: 'document' }
    : { uuid: 'ven-1', name: 'Marble Supply Co', active: true, confidence: 'high', source: 'document', ...over.vendor };
  if (over.linkedPurchaseOrder) doc.resolution.linkedPurchaseOrder = over.linkedPurchaseOrder;
  return doc;
}
