import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { readDraft, removeDraft, writeDraft } from '@/lib/documentReviewDraft';
import { ExtractionApiError, documentExtractionService } from '@/services/documentExtractionService';
import { IN_FLIGHT_STATUSES, type DocumentExtraction } from '@/types/documentExtraction';

/** Query-string parameter that puts the Add page into review mode. */
export const FROM_DOCUMENT_PARAM = 'fromDocument';
const DRAFT_DEBOUNCE_MS = 500;
const HTTP_NOT_FOUND = 404;

/** off: manual create. failed: the document couldn't be read (the reason is on
 *  the extraction). unavailable: discarded / not found. */
export type ReviewPhase = 'off' | 'loading' | 'ready' | 'expired' | 'used' | 'failed' | 'unavailable';

export interface UseDocumentReview<S> {
  /** The extraction id from ?fromDocument, or null in manual-create mode. */
  extractionId: string | null;
  phase: ReviewPhase;
  extraction: DocumentExtraction | undefined;
  /** Record created from this extraction, when it was already used. */
  usedRecordUuid: string | undefined;
  /** Draft found in sessionStorage on mount (read before any prefill). */
  restoredDraft: S | null;
  /** True once the draft was restored or the prefill applied; saving starts then. */
  hydrated: boolean;
  markHydrated: () => void;
  /** Deletes the draft and stops further saves. */
  clearDraft: () => void;
}

/** Derives the phase from the query outcome. Exported for tests. */
export function derivePhase(
  hasId: boolean, data: DocumentExtraction | undefined, error: unknown, isPending: boolean,
): ReviewPhase {
  if (!hasId) return 'off';
  if (error instanceof ExtractionApiError) {
    if (error.status === HTTP_NOT_FOUND && error.code === 'expired') return 'expired';
    if (!data) return 'unavailable';
  }
  if (data) {
    if (data.recordUuid || data.status === 'used' || data.status === 'attached') return 'used';
    if (data.status === 'ready') return 'ready';
    if (data.status === 'failed') return 'failed';
    if ((IN_FLIGHT_STATUSES as readonly string[]).includes(data.status)) return 'loading';
    return 'unavailable';
  }
  return isPending ? 'loading' : 'unavailable';
}

/** Loads the extraction named by ?fromDocument for the review screen (refetching
 *  on window focus / tab visibility so an expiry shows up) and persists the
 *  caller's form snapshot as a debounced sessionStorage draft. */
export function useDocumentReview<S>(snapshot: S): UseDocumentReview<S> {
  const [params] = useSearchParams();
  const extractionId = params.get(FROM_DOCUMENT_PARAM);
  const [restoredDraft] = useState<S | null>(() => (extractionId ? readDraft<S>(extractionId) : null));
  const [hydrated, setHydrated] = useState(false);
  const stoppedRef = useRef(false);

  const { data, error, isPending } = useQuery({
    queryKey: ['document-extraction', extractionId],
    queryFn: () => documentExtractionService.get(extractionId as string),
    enabled: Boolean(extractionId),
    staleTime: 0,
    refetchOnWindowFocus: 'always',
    retry: false,
  });

  const serialized = JSON.stringify(snapshot);
  useEffect(() => {
    if (!extractionId || !hydrated) return undefined;
    const timer = setTimeout(() => {
      if (!stoppedRef.current) writeDraft(extractionId, JSON.parse(serialized));
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [extractionId, hydrated, serialized]);

  const markHydrated = useCallback(() => setHydrated(true), []);
  const clearDraft = useCallback(() => {
    stoppedRef.current = true;
    if (extractionId) removeDraft(extractionId);
  }, [extractionId]);

  return {
    extractionId,
    phase: derivePhase(Boolean(extractionId), data, error, isPending),
    extraction: data,
    usedRecordUuid: data?.recordUuid,
    restoredDraft,
    hydrated,
    markHydrated,
    clearDraft,
  };
}
