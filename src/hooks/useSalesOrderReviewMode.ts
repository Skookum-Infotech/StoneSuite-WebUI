import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CustomerRef } from '@/pages/sales/components/CustomerPicker';
import { PENDING_DOCUMENTS_KEY } from '@/hooks/useDocumentExtraction';
import { useCustomerRef } from '@/hooks/useCustomerRef';
import { useDocumentReview } from '@/hooks/useDocumentReview';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { salesOrderPath } from '@/lib/documentExtractionRoutes';
import { clearDuplicateAck, isDuplicateAcknowledged } from '@/lib/documentDuplicateAck';
import { deleteDocumentFile, getDocumentFile } from '@/lib/documentFileRegistry';
import { focusReviewTarget } from '@/lib/documentReviewFocus';
import {
  blockingItems, confirmableKeys, pendingReviewItems, reviewProgress, saveBlockedReason, type ReviewContext,
} from '@/lib/documentReviewState';
import {
  buildSalesOrderHandoff, lineReviewKey, type HandoffExtras, type HandoffGeo, type SalesOrderHandoff,
} from '@/lib/salesOrderDocumentHandoff';
import { overlayDocumentValues } from '@/lib/salesOrderHandoffMerge';
import { fillDraftGaps } from '@/lib/salesOrderDraftRefresh';
import { soDefaults } from '@/lib/salesOrderForm';
import { duplicateFrom, type DuplicateConflict } from '@/lib/salesOrderDuplicate';
import { buildCompleteInput, learnedCustomerNote } from '@/lib/salesOrderReviewSave';
import type { SOLineItem } from '@/lib/salesOrderForm';
import { ExtractionApiError, documentExtractionService } from '@/services/documentExtractionService';
import type { ExtractedPageRows } from '@/types/documentExtraction';
import type { SalesOrder, SalesOrderCreatePayload } from '@/types/salesOrder';

const LIST_PATH = '/sales/sales_order';
const AI_UNAVAILABLE_WARNING = 'ai_unavailable';
const NO_PAGES: ExtractedPageRows[] = [];
const ZERO_EXTRAS: HandoffExtras = { expectedDelivery: '', shippingCharge: 0, adjustment: 0 };

import type { DocFocus, DraftSnapshot, ReviewForm, ReviewPatch } from './salesOrderReviewTypes';

export type { DocFocus, ReviewForm, ReviewPatch };

interface Args {
  form: ReviewForm;
  /** Writes (part of) the page's form state. */
  apply: (next: ReviewPatch) => void;
  /** The page's customer-change handler (merges the customer's defaults). */
  onCustomerChange: (c: CustomerRef | null) => void;
  /** Country/state lookups; the prefill waits for them so states resolve to ids. */
  geo: HandoffGeo | undefined;
}

/** Everything the Add Sales Order page needs for "review a document" mode:
 *  loads the extraction, prefills once (or restores the draft), tracks what is
 *  still unresolved, and owns the save-side extras (duplicate, complete, discard).
 *  Inert (`active === false`) when the page has no ?fromDocument. */
export function useSalesOrderReviewMode({ form, apply, onCustomerChange, geo }: Args) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [reviewed, setReviewed] = useState<ReadonlySet<string>>(() => new Set());
  const [extras, setExtras] = useState<HandoffExtras>(ZERO_EXTRAS);
  const [focus, setFocus] = useState<DocFocus | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateConflict | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  // The document-resolved customer whose defaults are still to be loaded and merged.
  const [defaultsFor, setDefaultsFor] = useState<string | undefined>(undefined);
  const defaultsDone = useRef(false);

  const snapshot: DraftSnapshot = { form, reviewed: Array.from(reviewed), extras };
  const doc = useDocumentReview<DraftSnapshot>(snapshot);
  const { extractionId, phase, extraction, restoredDraft, hydrated, markHydrated } = doc;
  const active = phase !== 'off';
  const fileName = extraction?.fileName ?? 'document';
  const file = useMemo(() => (extractionId ? getDocumentFile(extractionId) : undefined), [extractionId]);

  const result = extraction?.result;
  const handoff: SalesOrderHandoff | null = useMemo(
    () => (result && geo && (phase === 'ready' || phase === 'expired') ? buildSalesOrderHandoff(result, fileName, geo) : null),
    [result, phase, fileName, geo],
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
      apply(handoff ? fillDraftGaps(restoredDraft.form, handoff) : restoredDraft.form);
      setReviewed(new Set(restoredDraft.reviewed));
      setExtras(restoredDraft.extras);
      markHydrated();
    } else if (phase === 'ready' && handoff) {
      apply({
        data: handoff.data,
        lineItems: handoff.lineItems,
        customer: handoff.customer.resolved,
      });
      setExtras(handoff.extras);
      setDefaultsFor(handoff.customer.resolved?.id);
      markHydrated();
    } else if (phase === 'expired' || phase === 'used' || phase === 'unavailable') {
      markHydrated();
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [active, hydrated, restoredDraft, phase, handoff, apply, markHydrated]);

  // The resolved customer arrives as {id, name} only; load its record so its
  // defaults (terms, tax, addresses) go through the page's customer-change
  // handler, then put the document's own values back on top.
  const customerRef = useCustomerRef(defaultsFor);
  const loadedCustomer = customerRef.data;
  useEffect(() => {
    if (!loadedCustomer || !handoff || defaultsDone.current) return;
    defaultsDone.current = true;
    if (form.customer?.id !== loadedCustomer.id) return; // the reviewer already picked another
    onCustomerChange(loadedCustomer);
    const base = soDefaults();
    apply({ data: (d) => overlayDocumentValues(d, handoff.data, base) });
  }, [loadedCustomer, handoff, form.customer, onCustomerChange, apply]);

  const lineIdByKey = useMemo(
    () => new Map((handoff?.lines ?? []).map((l) => [lineReviewKey(l.lineNo), l.id])),
    [handoff],
  );
  const ctx: ReviewContext = useMemo(() => ({
    hasCustomer: form.customer !== null,
    lineHasItem: (key) => {
      const id = lineIdByKey.get(key);
      if (!id) return true;
      const li = form.lineItems.find((l) => l.id === id);
      return li ? Boolean(li.inventoryItemUuid) : true;
    },
    reviewed,
  }), [form.customer, form.lineItems, lineIdByKey, reviewed]);

  const pending = useMemo(() => (handoff ? pendingReviewItems(handoff.reviewItems, ctx) : []), [handoff, ctx]);
  const progress = useMemo(
    () => (handoff ? reviewProgress(handoff.provenance, handoff.reviewItems, ctx) : { done: 0, total: 0 }),
    [handoff, ctx],
  );
  const usedBlock = phase === 'used' ? 'This document was already used' : '';
  const blockedReason = active ? usedBlock || saveBlockedReason(pending) : '';
  const requiredPending = blockingItems(pending);

  const formAmounts = useMemo(
    () => new Map(form.lineItems.map((l) => [l.id, parseFloat(l.amount) || 0])),
    [form.lineItems],
  );
  const preTaxTotal = useMemo(
    () => Array.from(formAmounts.values()).reduce((s, n) => s + n, 0) + extras.shippingCharge + extras.adjustment,
    [formAmounts, extras],
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

  const pickCustomer = useCallback((c: CustomerRef) => {
    onCustomerChange(c);
    markReviewed(['customer']);
  }, [onCustomerChange, markReviewed]);
  const updateLine = useCallback((id: string, patch: Partial<SOLineItem>) => {
    apply({ lineItems: form.lineItems.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  }, [apply, form.lineItems]);

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

  const payloadExtras = useCallback((allowDuplicate: boolean): Partial<SalesOrderCreatePayload> => {
    if (!active) return {};
    return {
      ...(extras.expectedDelivery ? { expectedDelivery: extras.expectedDelivery } : {}),
      shippingCharge: extras.shippingCharge,
      adjustment: extras.adjustment,
      ...(allowDuplicate ? { allowDuplicate: true } : {}),
    };
  }, [active, extras]);

  /** Handles a create error. A 409 for the very order the reviewer already
   *  accepted on the upload dialog is resubmitted via `createAnyway` instead
   *  of asking twice; any other duplicate (e.g. one a second clerk just saved)
   *  opens the dialog. */
  const handleSaveError = useCallback((err: unknown, createAnyway: () => void): boolean => {
    if (!active) return false;
    const dup = duplicateFrom(err);
    if (!dup) return false;
    if (extractionId && isDuplicateAcknowledged(extractionId, dup.existingUuid)) createAnyway();
    else setDuplicate(dup);
    return true;
  }, [active, extractionId]);

  const finish = useCallback(() => {
    doc.clearDraft();
    if (extractionId) {
      deleteDocumentFile(extractionId);
      clearDuplicateAck(extractionId);
    }
    queryClient.invalidateQueries({ queryKey: PENDING_DOCUMENTS_KEY });
  }, [doc, extractionId, queryClient]);

  /** After a successful create: tell the server (feeds learning), clean up, toast. */
  const afterCreate = useCallback(async (order: SalesOrder): Promise<void> => {
    if (!extractionId || !handoff) return;
    const input = buildCompleteInput(
      order.id,
      {
        customerUuid: form.customer?.id ?? '',
        poNumber: String(form.data.purchase_doc_num ?? ''),
        orderDate: String(form.data.date_created ?? ''),
      },
      handoff.lines, form.lineItems,
    );
    try {
      await documentExtractionService.complete(extractionId, input);
    } catch (err) {
      if (!(err instanceof ExtractionApiError && err.code === 'already_used')) {
        console.error('document extraction complete failed', err);
        toast.error("Your order was saved, but we couldn't record it against the document.");
      }
    }
    finish();
    toast.success(`Sales Order ${order.salesOrderNumber} created from ${fileName}`, {
      description: learnedCustomerNote(handoff, form.customer) || undefined,
      action: { label: 'View', onClick: () => navigate(salesOrderPath(order.id)) },
    });
  }, [extractionId, handoff, form, fileName, finish, navigate]);

  const confirmDiscard = useCallback((markClean: () => void) => {
    setConfirmingDiscard(false);
    if (extractionId) {
      documentExtractionService.discard(extractionId).catch((err: unknown) => {
        console.error('document extraction discard failed', err);
      });
    }
    finish();
    markClean();
    navigate(LIST_PATH);
  }, [extractionId, finish, navigate]);

  return {
    active, phase, fileName, file, handoff, pages: result?.extracted.pages ?? NO_PAGES, hydrated, form, extras, reviewed,
    pending, requiredPending, blockedReason, progress, preTaxTotal, formAmounts, focus,
    banner: {
      usedRecordUuid: doc.usedRecordUuid,
      aiUnavailable: (result?.extracted.warnings ?? []).includes(AI_UNAVAILABLE_WARNING),
      injection: (result?.extracted.injection ?? []).length > 0,
    },
    duplicate, confirmingDiscard,
    toggleReviewed, confirmAllHigh, pickCustomer, updateLine, focusField, showInDocument, jumpTo,
    payloadExtras, handleSaveError, afterCreate, confirmDiscard,
    dismissDuplicate, requestDiscard, cancelDiscard, focusFirstPending, announcement,
  };
}

export type { DuplicateConflict };

/** The review-mode controller returned by useSalesOrderReviewMode. */
export type SalesOrderReviewMode = ReturnType<typeof useSalesOrderReviewMode>;
