import { useCallback, useEffect, useReducer, useRef } from 'react';
import { AxiosError } from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BACKGROUND_OFFER_SECONDS,
  POLL_INTERVAL_MS,
  extractionReducer,
  initialExtractionState,
  retryDelayMs,
  willAutoRetry,
  type ExtractionState,
} from '@/lib/documentExtractionMachine';
import { deleteDocumentFile, setDocumentFile } from '@/lib/documentFileRegistry';
import { validateDocumentFile } from '@/lib/documentUploadValidation';
import { UploadError } from '@/services/attachmentService';
import { ExtractionApiError, documentExtractionService, sha256Hex } from '@/services/documentExtractionService';
import { IN_FLIGHT_STATUSES, type DocumentExtraction, type DocumentExtractionDocType } from '@/types/documentExtraction';

const ELAPSED_TICK_MS = 1000;
const HTTP_NOT_FOUND = 404;
const CODE_EXPIRED = 'expired';
const UNAVAILABLE_MESSAGE = 'This document is no longer available. You can still fill in the order by hand.';
/** A presigned URL this close to expiry is re-issued before use. */
const PRESIGN_EXPIRY_MARGIN_MS = 30_000;
const POLL_RETRIES = 2;

export const PENDING_DOCUMENTS_KEY = ['document-extractions', 'ready'] as const;
const extractionKey = (id: string | null) => ['document-extraction', id] as const;

export interface UseDocumentExtraction {
  state: ExtractionState;
  /** Latest server copy of the extraction (set once the job is being read). */
  extraction: DocumentExtraction | undefined;
  /** True once reading has run long enough to offer "Continue in background". */
  canContinueInBackground: boolean;
  start: (file: File) => Promise<void>;
  retry: () => void;
  cancel: () => void;
  /** Asks the server to notify on completion; resolves false if that call failed. */
  continueInBackground: () => Promise<boolean>;
  reset: () => void;
}

interface UploadTarget {
  url: string;
  expiresAt: number;
}

/** Drives the Upload -> Read -> Match -> Review flow for one document: validate,
 *  hash, register, PUT to R2 (auto-retrying interruptions), start the job and
 *  poll it. State transitions live in the pure reducer in
 *  lib/documentExtractionMachine; this hook only performs the side effects. */
export function useDocumentExtraction(docType: DocumentExtractionDocType = 'sales_order'): UseDocumentExtraction {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(extractionReducer, initialExtractionState);
  const fileRef = useRef<File | null>(null);
  const shaRef = useRef('');
  const idRef = useRef<string | null>(null);
  const targetRef = useRef<UploadTarget | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Bumped on every start/cancel so a slow async step can tell it was superseded.
  const runRef = useRef(0);

  const failFromApi = useCallback((err: unknown, at: 'upload' | 'read') => {
    if (err instanceof ExtractionApiError) {
      if (err.code === 'daily_limit') return dispatch({ type: 'LIMIT' });
      if (err.code === 'ai_disabled') return dispatch({ type: 'AI_DISABLED' });
      if (err.code === 'storage_full') return dispatch({ type: 'STORAGE_FULL' });
      if (err.code === 'upload_missing') return dispatch({ type: 'START_MISSING' });
      return dispatch({ type: 'FAIL', code: err.code ?? 'unknown', message: err.message, at });
    }
    if (err instanceof AxiosError && !err.response) {
      return dispatch({ type: 'UPLOAD_FAILED', retryable: true });
    }
    const message = err instanceof Error ? err.message : "We couldn't process this document.";
    return dispatch({ type: 'FAIL', code: 'unknown', message, at });
  }, []);

  const start = useCallback(async (file: File) => {
    runRef.current += 1;
    const run = runRef.current;
    fileRef.current = file;
    dispatch({ type: 'PICK', fileName: file.name });

    const invalid = validateDocumentFile(file);
    if (invalid) {
      dispatch({ type: 'FAIL', code: 'invalid_file', message: invalid, at: 'upload' });
      return;
    }
    try {
      shaRef.current = await sha256Hex(file);
      const created = await documentExtractionService.create({
        docType, fileName: file.name, sizeBytes: file.size, contentType: file.type,
      });
      if (run !== runRef.current) {
        // Cancelled while registering — don't leave the staged row behind.
        documentExtractionService.discard(created.id).catch(() => undefined);
        return;
      }
      idRef.current = created.id;
      targetRef.current = { url: created.uploadUrl, expiresAt: Date.parse(created.expiresAt) };
      setDocumentFile(created.id, file);
      dispatch({ type: 'CREATED', id: created.id });
    } catch (err) {
      if (run === runRef.current) failFromApi(err, 'upload');
    }
  }, [docType, failFromApi]);

  // Runs (or re-runs) the upload each time the machine enters 'uploading'.
  useEffect(() => {
    if (state.stage !== 'uploading') return undefined;
    const file = fileRef.current;
    const id = idRef.current;
    if (!file || !id) return undefined;
    const abort = new AbortController();
    abortRef.current = abort;

    (async () => {
      try {
        let target = targetRef.current;
        if (!target || Date.now() >= target.expiresAt - PRESIGN_EXPIRY_MARGIN_MS) {
          const p = await documentExtractionService.presign(id);
          target = { url: p.uploadUrl, expiresAt: Date.parse(p.expiresAt) };
          targetRef.current = target;
        }
        await documentExtractionService.upload(
          target.url, file,
          (pct) => { if (!abort.signal.aborted) dispatch({ type: 'PROGRESS', pct }); },
          abort.signal,
        );
        await documentExtractionService.start(id, shaRef.current);
        if (!abort.signal.aborted) dispatch({ type: 'START_OK' });
      } catch (err) {
        if (abort.signal.aborted) return;
        if (err instanceof UploadError) {
          if (err.kind === 'aborted') return;
          dispatch({ type: 'UPLOAD_FAILED', retryable: err.kind === 'retryable' });
          return;
        }
        failFromApi(err, 'upload');
      }
    })();

    return () => abort.abort();
  }, [state.stage, failFromApi]);

  // Automatic retry with backoff, waiting for connectivity first.
  const autoRetry = willAutoRetry(state);
  const attempt = state.attempt;
  useEffect(() => {
    if (!autoRetry) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      timer = setTimeout(() => dispatch({ type: 'RETRY_UPLOAD' }), retryDelayMs(attempt));
    };
    const onOnline = () => schedule();
    if (navigator.onLine) schedule();
    else window.addEventListener('online', onOnline, { once: true });
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [autoRetry, attempt]);

  // Poll the job while the server is working.
  const extractionId = state.extractionId;
  const reading = state.stage === 'reading';
  const query = useQuery({
    queryKey: extractionKey(extractionId),
    queryFn: () => documentExtractionService.get(extractionId as string),
    enabled: reading && extractionId !== null,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return !status || IN_FLIGHT_STATUSES.includes(status) ? POLL_INTERVAL_MS : false;
    },
    retry: POLL_RETRIES,
  });
  const polled = query.data;
  useEffect(() => {
    if (!reading || !polled) return;
    dispatch({
      type: 'POLLED', status: polled.status, failureCode: polled.failureCode, failureMessage: polled.failureMessage,
    });
    if (polled.status === 'ready') {
      void queryClient.invalidateQueries({ queryKey: PENDING_DOCUMENTS_KEY });
    }
  }, [reading, polled, queryClient]);
  const pollError = query.error;
  useEffect(() => {
    if (!reading || !pollError) return;
    if (pollError instanceof ExtractionApiError && pollError.status === HTTP_NOT_FOUND) {
      // Only an explicit 'expired' code means the 24 h window lapsed; any other 404 is just "gone".
      if (pollError.code === CODE_EXPIRED) dispatch({ type: 'EXPIRED' });
      else dispatch({ type: 'FAIL', code: 'unknown', at: 'read', message: UNAVAILABLE_MESSAGE });
    } else {
      dispatch({
        type: 'FAIL', code: 'unknown', at: 'read',
        message: "We lost contact while reading this document — check your connection and retry.",
      });
    }
  }, [reading, pollError]);

  // Elapsed seconds while reading.
  useEffect(() => {
    if (!reading) return undefined;
    const t0 = Date.now();
    const timer = setInterval(
      () => dispatch({ type: 'TICK', elapsedSec: Math.floor((Date.now() - t0) / 1000) }),
      ELAPSED_TICK_MS,
    );
    return () => clearInterval(timer);
  }, [reading]);

  const cancel = useCallback(() => {
    runRef.current += 1;
    abortRef.current?.abort();
    const id = idRef.current;
    if (id) {
      // Best effort: the staging sweeper purges anything this misses.
      documentExtractionService.discard(id).catch(() => undefined);
      deleteDocumentFile(id);
    }
    dispatch({ type: 'CANCEL' });
  }, []);

  const retry = useCallback(() => {
    if (state.stage === 'interrupted') {
      dispatch({ type: 'MANUAL_RETRY' });
      return;
    }
    const file = fileRef.current;
    const oldId = idRef.current;
    if (oldId) {
      documentExtractionService.discard(oldId).catch(() => undefined);
      deleteDocumentFile(oldId);
    }
    if (file) void start(file);
  }, [state.stage, start]);

  const continueInBackground = useCallback(async () => {
    const id = idRef.current;
    if (!id) return false;
    try {
      await documentExtractionService.notify(id);
      return true;
    } catch {
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    runRef.current += 1;
    abortRef.current?.abort();
    idRef.current = null;
    fileRef.current = null;
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    extraction: polled,
    canContinueInBackground: reading && state.elapsedSec >= BACKGROUND_OFFER_SECONDS,
    start, retry, cancel, continueInBackground, reset,
  };
}
