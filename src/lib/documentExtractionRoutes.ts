import type { DocumentExtractionDocType } from '@/types/documentExtraction';

/** Query-string parameter that puts an Add page into review mode. */
const FROM_DOCUMENT_QUERY = 'fromDocument';

/** Per-document-type routes and copy for the create-from-document flow. */
export interface DocumentRoutes {
  /** The list page (which also hosts the upload button). */
  listPath: string;
  /** The manual Add page; the review form is the same page with ?fromDocument. */
  newPath: string;
  /** Detail route of an existing record. */
  recordPath: (recordUuid: string) => string;
  /** The review route for a ready extraction. */
  fromDocumentPath: (extractionId: string) => string;
  /** Title-case name, e.g. "Purchase Order". */
  label: 'Sales Order' | 'Purchase Order' | 'Vendor Bill';
  /** Lower-case name used mid-sentence, e.g. "purchase order". */
  noun: 'sales order' | 'purchase order' | 'vendor bill';
  /** What "enter it manually" calls the document, e.g. "order". */
  manualNoun: 'order' | 'purchase order' | 'vendor bill';
  /** The counterparty the document names. */
  partyLabel: 'customer' | 'vendor';
}

function routesFor(base: string, label: DocumentRoutes['label'], noun: DocumentRoutes['noun'],
  manualNoun: DocumentRoutes['manualNoun'], partyLabel: DocumentRoutes['partyLabel']): DocumentRoutes {
  const newPath = `${base}/new`;
  return {
    listPath: base,
    newPath,
    recordPath: (recordUuid) => `${base}/${recordUuid}`,
    fromDocumentPath: (extractionId) => `${newPath}?${FROM_DOCUMENT_QUERY}=${encodeURIComponent(extractionId)}`,
    label, noun, manualNoun, partyLabel,
  };
}

const ROUTES: Record<DocumentExtractionDocType, DocumentRoutes> = {
  sales_order: routesFor('/sales/sales_order', 'Sales Order', 'sales order', 'order', 'customer'),
  purchase_order: routesFor('/purchases/purchase_order', 'Purchase Order', 'purchase order', 'purchase order', 'vendor'),
  vendor_bill: routesFor('/purchases/vendor_bill', 'Vendor Bill', 'vendor bill', 'vendor bill', 'vendor'),
};

/** The routes and copy for a document type's create-from-document flow. */
export function documentRoutes(docType: DocumentExtractionDocType): DocumentRoutes {
  return ROUTES[docType];
}

/** Duplicate kinds that should stop and ask before opening the review form. The
 *  quote/estimate/same_reference findings are informational and don't gate it. */
export const BLOCKING_DUPLICATE_KINDS: ReadonlySet<string> = new Set(['same_file', 'same_po', 'revision', 'same_invoice']);
