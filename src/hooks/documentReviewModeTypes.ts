import type { DocumentHandoffBase, ReviewItem } from '@/lib/documentHandoffShared';
import type {
  CompleteExtractionInput, DocumentExtractionDocType, ExtractionResultDoc,
} from '@/types/documentExtraction';

/** Which document row the focused field came from. `nonce` bumps only on an
 *  explicit "Show in document" so the pane can expand and switch page. */
export interface DocFocus {
  page?: number;
  row?: number;
  nonce: number;
}

/** What review mode keeps in the sessionStorage draft. */
export interface ReviewDraft<F, X> {
  form: F;
  reviewed: string[];
  extras: X;
}

/** A picked / resolved counterparty (customer or vendor). */
export interface ReviewParty {
  id: string;
  name: string;
}

/** The toast shown once a record has been created from the document. */
export interface CreatedSummary {
  recordId: string;
  /** e.g. "Sales Order SO-12 created from po.pdf". */
  title: string;
  description?: string;
}

/** The document-specific half of review mode. The generic lifecycle
 *  (useDocumentReviewMode) owns fetch/poll, phase, draft, review progress,
 *  duplicate acknowledgement, /complete and discard; an adapter supplies how a
 *  document becomes a form and what is saved. `F` is the page's form state,
 *  `Patch` a write to it, `X` header values with no form input (sent with the
 *  create payload), `H` the handoff, `P` the party, `R` the created record and
 *  `PL` the create payload's extra fields.
 *
 *  Memoize the adapter: its identity keys the handoff and the effects. */
export interface DocumentReviewAdapter<F, Patch, X, H extends DocumentHandoffBase, P extends ReviewParty, R, PL> {
  docType: DocumentExtractionDocType;
  /** Review key of the party row, e.g. 'customer'. */
  partyReviewKey: string;
  /** Fallback text of a 409 duplicate_document that carries no message. */
  duplicateMessage: string;
  initialExtras: X;
  /** The handoff for a result, or null while a lookup it needs (geo) is loading. */
  buildHandoff: (result: ExtractionResultDoc, fileName: string) => H | null;
  extrasOf: (handoff: H) => X;
  /** The form write that prefills a fresh review. */
  prefill: (handoff: H) => Patch;
  /** A restored draft with its empty slots filled from the fresh match. */
  mergeDraft: (draft: F, handoff: H) => F;
  /** A whole form as a write to the page's form state. */
  toPatch: (form: F) => Patch;
  /** The party the server resolved, if any. */
  resolvedParty: (handoff: H) => ReviewParty | null;
  formParty: (form: F) => P | null;
  /** Loads the full record of a resolved party (its defaults); a hook. */
  usePartyRecord: (id: string | undefined) => { data?: P };
  /** Puts a picked / loaded party on the form with its defaults, then overlays
   *  the document's own values (a null party clears it). */
  applyParty: (party: P | null, handoff: H | null) => void;
  /** True when the form line has a catalog item; undefined for an unknown line. */
  lineHasItem: (form: F, lineId: string) => boolean | undefined;
  /** Per-line pre-tax amounts and the total tax the form currently carries. */
  lineStats: (form: F) => { amounts: Map<string, number>; tax: number };
  /** Live checks derived from the form (e.g. a unit mismatch on a picked item). */
  unitChecks: (handoff: H, form: F) => ReviewItem[];
  /** Dollars the extras (and form-held shipping / adjustment) add to the pre-tax total. */
  extrasAmount: (extras: X, form: F) => number;
  payloadExtras: (extras: X, allowDuplicate: boolean) => Partial<PL>;
  completeInput: (record: R, form: F, handoff: H) => CompleteExtractionInput;
  createdSummary: (record: R, form: F, handoff: H, fileName: string) => CreatedSummary;
}

/** What ReviewDialogs reads from a review-mode controller. */
export interface DocumentReviewDialogState {
  docType: DocumentExtractionDocType;
  duplicate: { message: string; existingUuid?: string; existingNumber?: string } | null;
  confirmingDiscard: boolean;
  dismissDuplicate: () => void;
  confirmDiscard: (markClean: () => void) => void;
  cancelDiscard: () => void;
}
