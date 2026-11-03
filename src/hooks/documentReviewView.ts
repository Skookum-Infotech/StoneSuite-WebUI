import type { HandoffBadges } from '@/lib/salesOrderHandoffTypes';
import type { DocumentHandoffBase, HandoffParty, ReviewItem } from '@/lib/documentHandoffShared';
import type {
  DocumentExtractionDocType, ExtractedPageRows, ProposedEntityView,
} from '@/types/documentExtraction';
import type { DocFocus, ReviewParty } from './documentReviewModeTypes';
import type { ReviewPhase } from './useDocumentReview';

/** The part of any document type's form line the generic review panels read. */
export interface ReviewLineLike {
  id: string;
  itemName: string;
  itemSku?: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  units?: string;
  inventoryItemUuid?: string;
}

/** A write to one form line; the money columns come from `calcLine`. */
export type ReviewLinePatch = Partial<ReviewLineLike> & { amount?: string; total?: string };

/** One purchase-order line a vendor-bill line may be billed against. */
export interface PoLineChoice {
  id: string;
  label: string;
}

/** The slice of a document handoff the generic review shell reads. */
export interface ReviewShellHandoff extends DocumentHandoffBase {
  docTotal: number | null;
  docTax: number;
  badges: HandoffBadges;
}

/** What the generic review components (shell, field and line panels) read from
 *  a document type's review-mode controller. Each type's thin hook adds the
 *  few type-specific members (the party's name for the form, the line math). */
export interface DocumentReviewView {
  docType: DocumentExtractionDocType;
  phase: ReviewPhase;
  fileName: string;
  file: File | undefined;
  pages: ExtractedPageRows[];
  focus: DocFocus | null;
  announcement: string;
  banner: { usedRecordUuid: string | undefined; aiUnavailable: boolean; injection: boolean };
  handoff: ReviewShellHandoff | null;
  /** The extraction being reviewed (null/absent in manual-create mode). */
  extractionId?: string | null;
  /** Unmatched customers/vendors/items offered as new records; absent or empty
   *  when the proposed-records feature is off. */
  proposedEntities?: ProposedEntityView[];
  /** The resolved or candidate counterparty (customer, or vendor). */
  party: HandoffParty | null;
  /** The party currently on the form. */
  formPartyId: string | undefined;
  lineItems: ReviewLineLike[];
  pending: ReviewItem[];
  reviewed: ReadonlySet<string>;
  progress: { done: number; total: number };
  preTaxTotal: number;
  formTax: number;
  formAmounts: Map<string, number>;
  /** What the form holds for a header review key (shown beside the document's text). */
  fieldValue: (key: string) => string;
  /** The money columns of a line after an edit. */
  calcLine: (line: ReviewLineLike) => { amount: string; total: string };
  updateLine: (id: string, patch: ReviewLinePatch) => void;
  /** Purchase-order lines a bill line could be billed against, when several fit. */
  poLineChoices?: (lineId: string) => PoLineChoice[];
  /** The PO line a bill line is currently billed against, or ''. */
  poLineOf?: (lineId: string) => string;
  setPoLine?: (lineId: string, poItemId: string) => void;
  pickParty: (party: ReviewParty | null) => void;
  toggleReviewed: (key: string) => void;
  confirmAllHigh: () => void;
  focusField: (page?: number, row?: number) => void;
  showInDocument: (page?: number, row?: number) => void;
  jumpTo: (key: string) => void;
}

/** Which header rows the field panel shows for a document type, and how. */
export interface ReviewFieldConfig {
  order: readonly string[];
  labels: Record<string, string>;
  /** Review key of the party row. */
  partyKey: string;
  /** Aria-label fragment of the form's party search control. */
  partySearchSelector: string;
}
