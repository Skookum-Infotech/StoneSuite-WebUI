import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PENDING_DOCUMENTS_KEY } from '@/hooks/useDocumentExtraction';
import { useDocumentReview } from '@/hooks/useDocumentReview';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { documentRoutes } from '@/lib/documentExtractionRoutes';
import { clearDuplicateAck, isDuplicateAcknowledged } from '@/lib/documentDuplicateAck';
import { deleteDocumentFile, getDocumentFile } from '@/lib/documentFileRegistry';
import { focusReviewTarget } from '@/lib/documentReviewFocus';
import type { DocumentHandoffBase } from '@/lib/documentHandoffShared';
import { lineReviewKey } from '@/lib/documentHandoffShared';
import {
  blockingItems, confirmableKeys, pendingReviewItems, reviewProgress, saveBlockedReason, type ReviewContext,
} from '@/lib/documentReviewState';
import { duplicateFrom, type DuplicateConflict } from '@/lib/salesOrderDuplicate';
import { failureText } from '@/lib/documentExtractionMachine';
import { ExtractionApiError, documentExtractionService } from '@/services/documentExtractionService';
import type { ExtractedPageRows } from '@/types/documentExtraction';
import type { DocFocus, DocumentReviewAdapter, ReviewDraft, ReviewParty } from './documentReviewModeTypes';

const AI_UNAVAILABLE_WARNING = 'ai_unavailable';
const NO_PAGES: ExtractedPageRows[] = [];

interface Args<F, Patch, X, H extends DocumentHandoffBase, P extends ReviewParty, R, PL> {
  adapter: DocumentReviewAdapter<F, Patch, X, H, P, R, PL>;
  form: F;
  /** Writes (part of) the page's form state. */
  apply: (next: Patch) => void;
}

/** The document-type-neutral "review a document" lifecycle for an Add page:
 *  loads the extraction, prefills once (or restores the draft), tracks what is
 *  still unresolved, and owns the save-side extras (duplicate, complete,
 *  discard). Inert (`active === false`) when the page has no ?fromDocument.
 *  Everything document-specific comes from the adapter. */
export function useDocumentReviewMode<F, Patch, X, H extends DocumentHandoffBase, P extends ReviewParty, R, PL>(
  { adapter, form, apply }: Args<F, Patch, X, H, P, R, PL>,
) {
  const { docType, usePartyRecord } = adapter;
  const routes = documentRoutes(docType);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [reviewed, setReviewed] = useState<ReadonlySet<string>>(() => new Set());
  const [extras, setExtras] = useState<X>(adapter.initialExtras);
  const [focus, setFocus] = useState<DocFocus | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateConflict | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  // The document-resolved party whose defaults are still to be loaded and merged.
  const [defaultsFor, setDefaultsFor] = useState<string | undefined>(undefined);
  const defaultsDone = useRef(false);

  const snapshot: ReviewDraft<F, X> = { form, reviewed: Array.from(reviewed), extras };
  const doc = useDocumentReview<ReviewDraft<F, X>>(snapshot);
  const { extractionId, phase, extraction, restoredDraft, hydrated, markHydrated } = doc;
  const active = phase !== 'off';
  const fileName = extraction?.fileName ?? 'document';
  const file = useMemo(() => (extractionId ? getDocumentFile(extractionId) : undefined), [extractionId]);

  const result = extraction?.result;
  const handoff: H | null = useMemo(
    () => (result && (phase === 'ready' || phase === 'expired') ? adapter.buildHandoff(result, fileName) : null),
    [result, phase, fileName, adapter],
  );

  // Restore the draft, else prefill — exactly once.
  useEffect(() => {
    if (!active || hydrated) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    // A draft is only trusted once the extraction itself loaded for this user —
    // otherwise a draft left in the tab could be applied to a document that
    // turns out to be unavailable / belong to someone else.
    if (restoredDraft && (phase === 'ready' || phase === 'expired')) {
      if (phase === 'ready' && !handoff) return; // wait for the fresh match to fill draft gaps
      apply(adapter.toPatch(handoff ? adapter.mergeDraft(restoredDraft.form, handoff) : restoredDraft.form));
      setReviewed(new Set(restoredDraft.reviewed));
      setExtras(restoredDraft.extras);
      markHydrated();
    } else if (phase === 'ready' && handoff) {
      apply(adapter.prefill(handoff));
      setExtras(adapter.extrasOf(handoff));
      setDefaultsFor(adapter.resolvedParty(handoff)?.id);
      markHydrated();
    } else if (phase === 'expired' || phase === 'used' || phase === 'failed' || phase === 'unavailable') {
      markHydrated();
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [active, hydrated, restoredDraft, phase, handoff, apply, markHydrated, adapter]);

  // The resolved party arrives as {id, name} only; load its record so its
  // defaults (terms, tax, addresses) go through the page's party-change handler,
  // then put the document's own values back on top.
  const loadedParty = usePartyRecord(defaultsFor).data;
  useEffect(() => {
    if (!loadedParty || !handoff || defaultsDone.current) return;
    defaultsDone.current = true;
    if (adapter.formParty(form)?.id !== loadedParty.id) return; // the reviewer already picked another
    adapter.applyParty(loadedParty, handoff);
  }, [loadedParty, handoff, form, adapter]);

  const lineIdByKey = useMemo(
    () => new Map((handoff?.lines ?? []).map((l) => [lineReviewKey(l.lineNo), l.id])),
    [handoff],
  );
  const ctx: ReviewContext = useMemo(() => ({
    hasCustomer: adapter.formParty(form) !== null,
    partyKey: adapter.partyReviewKey,
    lineHasItem: (key) => {
      const id = lineIdByKey.get(key);
      return id ? (adapter.lineHasItem(form, id) ?? true) : true;
    },
    reviewed,
  }), [adapter, form, lineIdByKey, reviewed]);

  // The handoff's checklist plus live checks derived from the form.
  const reviewItems = useMemo(
    () => (handoff ? [...handoff.reviewItems, ...adapter.unitChecks(handoff, form)] : []),
    [handoff, adapter, form],
  );
  const pending = useMemo(() => (handoff ? pendingReviewItems(reviewItems, ctx) : []), [handoff, reviewItems, ctx]);
  const progress = useMemo(
    () => (handoff ? reviewProgress(handoff.provenance, reviewItems, ctx) : { done: 0, total: 0 }),
    [handoff, reviewItems, ctx],
  );
  const usedBlock = phase === 'used' ? 'This document was already used' : '';
  const blockedReason = active ? usedBlock || saveBlockedReason(pending) : '';
  const requiredPending = blockingItems(pending);

  const stats = useMemo(() => adapter.lineStats(form), [adapter, form]);
  const formAmounts = stats.amounts;
  const formTax = stats.tax;
  const preTaxTotal = useMemo(
    () => Array.from(formAmounts.values()).reduce((s, n) => s + n, 0) + adapter.extrasAmount(extras, form),
    [formAmounts, adapter, extras, form],
  );

  const toggleReviewed = useCallback((key: string) => {
    setReviewed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const markReviewed = useCallback((keys: string[]) => {
    setReviewed((prev) => new Set([...prev, ...keys]));
  }, []);
  const confirmAllHigh = useCallback(() => {
    if (handoff) markReviewed(confirmableKeys(handoff.provenance, handoff.reviewItems));
  }, [handoff, markReviewed]);

  /** A party picked during review — from the panel or the form's own picker.
   *  Its defaults are merged, then the document's values go back on top, exactly
   *  as for a party the server resolved. */
  const pickParty = useCallback((p: P | null) => {
    adapter.applyParty(p, handoff);
    if (p) markReviewed([adapter.partyReviewKey]);
  }, [adapter, handoff, markReviewed]);

  const focusField = useCallback((page?: number, row?: number) => {
    setFocus((prev) => ({ page, row, nonce: prev?.nonce ?? 0 }));
  }, []);
  const showInDocument = useCallback((page?: number, row?: number) => {
    setFocus((prev) => ({ page, row, nonce: (prev?.nonce ?? 0) + 1 }));
    setAnnouncement(
      [page !== undefined ? `Showing page ${page}` : 'Showing the document', row !== undefined ? `row ${row}` : '']
        .filter(Boolean).join(', ') + ' in document',
    );
  }, []);
  const jumpTo = useCallback((key: string) => { focusReviewTarget(key, reduceMotion); }, [reduceMotion]);
  const firstPendingKey = pending[0]?.key;
  const focusFirstPending = useCallback(() => {
    if (firstPendingKey) focusReviewTarget(firstPendingKey, reduceMotion);
  }, [firstPendingKey, reduceMotion]);
  const dismissDuplicate = useCallback(() => setDuplicate(null), []);
  const requestDiscard = useCallback(() => setConfirmingDiscard(true), []);
  const cancelDiscard = useCallback(() => setConfirmingDiscard(false), []);

  const payloadExtras = useCallback(
    (allowDuplicate: boolean): Partial<PL> => (active ? adapter.payloadExtras(extras, allowDuplicate) : {}),
    [active, adapter, extras],
  );

  /** Handles a create error. A 409 for the very document the reviewer already
   *  accepted on the upload dialog is resubmitted via `createAnyway` instead
   *  of asking twice; any other duplicate (e.g. one a second clerk just saved)
   *  opens the dialog. */
  const handleSaveError = useCallback((err: unknown, createAnyway: () => void): boolean => {
    if (!active) return false;
    const dup = duplicateFrom(err, adapter.duplicateMessage);
    if (!dup) return false;
    if (extractionId && isDuplicateAcknowledged(extractionId, dup.existingUuid)) createAnyway();
    else setDuplicate(dup);
    return true;
  }, [active, adapter, extractionId]);

  const finish = useCallback(() => {
    doc.clearDraft();
    if (extractionId) {
      deleteDocumentFile(extractionId);
      clearDuplicateAck(extractionId);
    }
    queryClient.invalidateQueries({ queryKey: PENDING_DOCUMENTS_KEY });
  }, [doc, extractionId, queryClient]);

  /** After a successful create: tell the server (feeds learning), clean up, toast. */
  const afterCreate = useCallback(async (record: R): Promise<void> => {
    if (!extractionId || !handoff) return;
    try {
      await documentExtractionService.complete(extractionId, adapter.completeInput(record, form, handoff));
    } catch (err) {
      if (!(err instanceof ExtractionApiError && err.code === 'already_used')) {
        console.error('document extraction complete failed', err);
        toast.error(`Your ${routes.manualNoun} was saved, but we couldn't record it against the document.`);
      }
    }
    finish();
    const summary = adapter.createdSummary(record, form, handoff, fileName);
    toast.success(summary.title, {
      description: summary.description || undefined,
      action: { label: 'View', onClick: () => navigate(routes.recordPath(summary.recordId)) },
    });
  }, [extractionId, handoff, adapter, form, fileName, finish, navigate, routes]);

  const confirmDiscard = useCallback((markClean: () => void) => {
    setConfirmingDiscard(false);
    if (extractionId) {
      documentExtractionService.discard(extractionId).catch((err: unknown) => {
        console.error('document extraction discard failed', err);
      });
    }
    finish();
    markClean();
    navigate(routes.listPath);
  }, [extractionId, finish, navigate, routes]);

  return {
    docType, active, phase, fileName, file, handoff, pages: result?.extracted.pages ?? NO_PAGES, hydrated, form, extras, reviewed,
    pending, requiredPending, blockedReason, progress, preTaxTotal, formTax, formAmounts, focus,
    banner: {
      usedRecordUuid: doc.usedRecordUuid,
      failureMessage: phase === 'failed' ? failureText(extraction?.failureCode, extraction?.failureMessage) : '',
      aiUnavailable: (result?.extracted.warnings ?? []).includes(AI_UNAVAILABLE_WARNING),
      injection: (result?.extracted.injection ?? []).length > 0,
    },
    duplicate, confirmingDiscard,
    toggleReviewed, confirmAllHigh, pickParty, focusField, showInDocument, jumpTo,
    payloadExtras, handleSaveError, afterCreate, confirmDiscard,
    dismissDuplicate, requestDiscard, cancelDiscard, focusFirstPending, announcement,
  };
}
