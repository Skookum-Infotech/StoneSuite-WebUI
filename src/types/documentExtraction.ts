// Mirrors the Go JSON shapes in StoneSuite-Backend: docextract/types.go,
// docextractjob/store.go (Extraction, ResultDoc) and docextractjob/resolve*.go
// (Resolution, CustomerMatch, LineMatch, TermsMatch), duplicates.go (Duplicate).
// Money in `*Cents` fields is integer cents; `qtyMilli` is quantity x 1000.

export type DocumentExtractionDocType = 'sales_order' | 'purchase_order' | 'vendor_bill';

/** Server job states (docextractjob/doc.go). */
export type ExtractionStatus =
  | 'awaiting_upload'
  | 'queued'
  | 'running'
  | 'ready'
  | 'failed'
  | 'discarded'
  | 'used'
  | 'attached';

/** Statuses during which the server is still working — the poll continues. */
export const IN_FLIGHT_STATUSES: readonly ExtractionStatus[] = ['awaiting_upload', 'queued', 'running'];

/** docextract.FailureCode plus the job-level codes the worker sets. */
export type ExtractionFailureCode =
  | 'corrupt'
  | 'scanned'
  | 'unreadable_text'
  | 'password_protected'
  | 'unsupported_encryption'
  | 'page_cap'
  | 'line_cap'
  | 'too_large'
  | 'unsupported_type'
  | 'empty'
  | 'upload_corrupted'
  | 'upload_missing'
  | (string & {});

export type FieldSource = 'document' | 'learned' | 'catalog' | 'default';
/** Reviewer-facing confidence word, never a raw score. */
export type FieldConfidence = 'high' | 'check' | 'not_found';

/** docextract.Field — one extracted value with provenance. */
export interface ExtractedField {
  value: string;
  source: FieldSource;
  confidence: FieldConfidence;
  snippet?: string;
  page?: number;
  row?: number;
}

export type LineKind = 'product' | 'addon' | 'charge' | 'note';

/** docextract.Line. `parentLine` is a 1-based index into `lines`; 0/absent = none. */
export interface ExtractedLine {
  kind: LineKind;
  parentLine?: number;
  sku: ExtractedField;
  description: ExtractedField;
  uom: ExtractedField;
  qty: ExtractedField;
  unitPrice: ExtractedField;
  amount: ExtractedField;
  qtyMilli: number;
  unitPriceCents: number;
  amountCents: number;
  flags?: string[];
}

/** docextract.Header. */
export interface ExtractedHeader {
  poNumber: ExtractedField;
  orderDate: ExtractedField;
  deliveryDate: ExtractedField;
  customerName: ExtractedField;
  billTo: ExtractedField;
  shipTo: ExtractedField;
  paymentTerms: ExtractedField;
  subtotal: ExtractedField;
  tax: ExtractedField;
  shipping: ExtractedField;
  discount: ExtractedField;
  total: ExtractedField;
  currency: ExtractedField;
}

export interface ExtractedRevision {
  label: string;
  referencedNumber?: string;
}

export interface ExtractedWord {
  x: number;
  w: number;
  text: string;
}

export interface ExtractedRow {
  y: number;
  words: ExtractedWord[];
}

export interface ExtractedPageRows {
  page: number;
  rows: ExtractedRow[];
}

export interface ExtractionCheck {
  name: string;
  expected: number;
  actual: number;
  passed: boolean;
}

/** docextract.Result. */
export interface ExtractedResult {
  docType: DocumentExtractionDocType;
  header: ExtractedHeader;
  lines: ExtractedLine[];
  checks?: ExtractionCheck[];
  warnings?: string[];
  revision?: ExtractedRevision;
  quoteRef?: string;
  signed: boolean;
  restricted: boolean;
  classifiedAs?: string;
  pages: ExtractedPageRows[];
  layoutFingerprint?: string;
  unresolved?: string[];
  injection?: string[];
}

/** docextractjob.Candidate. */
export interface MatchCandidate {
  uuid: string;
  name: string;
  active: boolean;
  score: number;
}

/** docextractjob.CustomerMatch — `uuid` is absent when nothing matched. */
export interface CustomerMatch {
  uuid?: string;
  name?: string;
  active: boolean;
  statusName?: string;
  confidence: FieldConfidence;
  source: FieldSource;
  candidates?: MatchCandidate[];
}

/** docextractjob.ItemInfo. */
export interface ItemInfo {
  uuid: string;
  name: string;
  sku: string;
  unitCode: string;
  unitCategory: string;
  catalogPriceCents: number;
  active: boolean;
}

export type LineMatchMethod = 'alias' | 'sku' | 'name';

/** docextractjob.UnitConversion. */
export interface UnitConversion {
  fromUom: string;
  toUom: string;
  fromQtyMilli: number;
  qtyMilli: number;
  unitPriceCents: number;
}

/** docextractjob.LineMatch — `index` points into ExtractedResult.lines. */
export interface LineMatch {
  index: number;
  item?: ItemInfo;
  matchedBy?: LineMatchMethod;
  source?: FieldSource;
  flags?: string[];
  converted?: UnitConversion;
}

/** docextractjob.TermsMatch. */
export interface TermsMatch {
  id: number;
  name: string;
  code: string;
}

/** docextractjob.Resolution. */
export interface ExtractionResolution {
  customer: CustomerMatch;
  paymentTerms?: TermsMatch;
  lines: LineMatch[];
}

export type DuplicateKind =
  | 'same_file'
  | 'same_po'
  | 'revision'
  | 'quote_reference'
  | 'estimate_reference';

/** docextractjob.Duplicate. `recordUuid` is omitted when the caller's read
 *  scope doesn't cover the existing record (no "Open existing" then). */
export interface ExtractionDuplicate {
  kind: DuplicateKind;
  recordUuid?: string;
  number?: string;
  status?: string;
  reason: string;
}

/** docextractjob.ResultDoc — the stored `result` of a ready extraction. */
export interface ExtractionResultDoc {
  extracted: ExtractedResult;
  resolution: ExtractionResolution;
  duplicates: ExtractionDuplicate[];
}

/** docextractjob.Extraction, as returned by GET /{id} and the list. */
export interface DocumentExtraction {
  id: string;
  docType: DocumentExtractionDocType;
  status: ExtractionStatus;
  fileName: string;
  /** Not in the GET view (controllers/document_extraction_read.go). */
  contentType?: string;
  sizeBytes: number;
  method: string;
  model?: string;
  result?: ExtractionResultDoc;
  failureCode?: ExtractionFailureCode;
  /** Not on the Go struct today; the plan's GET shape carries it. Optional so a
   *  backend without it falls back to a client-side message per failureCode. */
  failureMessage?: string;
  notifyOnComplete?: boolean;
  recordUuid?: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt: string;
}

export interface CreateExtractionInput {
  docType: DocumentExtractionDocType;
  fileName: string;
  sizeBytes: number;
  contentType: string;
}

export interface CreateExtractionResult {
  id: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface PresignExtractionResult {
  uploadUrl: string;
  expiresAt: string;
}

/** Body of POST /{id}/complete — what the user actually saved (feeds learning). */
export interface CompleteExtractionInput {
  recordUuid: string;
  saved: {
    customerUuid: string;
    poNumber: string;
    orderDate: string;
    lines: Array<{ docSku: string; docDescription: string; itemUuid: string }>;
  };
}

/** Error `code`s the backend puts on non-2xx responses. */
export type ExtractionErrorCode =
  | 'ai_disabled'
  | 'daily_limit'
  | 'storage_full'
  | 'upload_missing'
  | 'expired'
  | 'already_used';
