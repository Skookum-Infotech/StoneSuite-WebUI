import * as React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, FileText, Loader2, WifiOff, X } from 'lucide-react';
import { useModalDialog } from '@/hooks/useModalDialog';
import { useDocumentExtraction } from '@/hooks/useDocumentExtraction';
import { acknowledgeDuplicates } from '@/lib/documentDuplicateAck';
import { MAX_AUTO_RETRIES, canRetryFailure, willAutoRetry, type ExtractionStage } from '@/lib/documentExtractionMachine';
import {
  BLOCKING_DUPLICATE_KINDS,
  SALES_ORDER_NEW_PATH,
  fromDocumentPath,
  salesOrderPath,
} from '@/lib/documentExtractionRoutes';
import type { DocumentExtractionDocType } from '@/types/documentExtraction';
import { DuplicateWarnings } from './DuplicateWarnings';
import { ExtractionStepper } from './ExtractionStepper';

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;
const TYPICAL_READ_SECONDS = 30;

/** Stages where closing the dialog abandons work in progress. */
const RUNNING_STAGES: ReadonlySet<ExtractionStage> = new Set(['validating', 'uploading', 'interrupted', 'reading']);

const PRIMARY_BTN =
  'rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 transition-all hover:bg-brand-hover active:scale-95';
const SECONDARY_BTN =
  'rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-300 transition-colors hover:bg-stone-50 dark:hover:bg-white/10';

function formatSize(bytes: number): string {
  return bytes >= BYTES_PER_MB
    ? `${(bytes / BYTES_PER_MB).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} KB`;
}

interface CreateFromDocumentDialogProps {
  file: File;
  docType?: DocumentExtractionDocType;
  onClose: () => void;
}

/** Compact processing dialog for create-from-document: shows the Upload -> Read
 *  -> Match -> Review stepper, upload progress, elapsed read time, failure and
 *  duplicate states, and hands off to the review form once the job is ready. */
export function CreateFromDocumentDialog({
  file, docType = 'sales_order', onClose,
}: CreateFromDocumentDialogProps): React.JSX.Element {
  const navigate = useNavigate();
  const { state, extraction, canContinueInBackground, start, retry, cancel, continueInBackground } =
    useDocumentExtraction(docType);
  const { stage } = state;

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start(file);
  }, [file, start]);

  // Closing a running dialog abandons it (abort + discard); otherwise it just closes.
  const closeRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    closeRef.current = () => {
      if (RUNNING_STAGES.has(stage)) cancel();
      else onClose();
    };
  }, [stage, cancel, onClose]);
  const handleClose = useCallback(() => closeRef.current(), []);
  const contentRef = useModalDialog(handleClose);

  useEffect(() => {
    if (stage === 'cancelled') onClose();
  }, [stage, onClose]);

  // Keep screen-reader/keyboard focus on the dialog when the buttons change.
  useEffect(() => {
    contentRef.current?.focus();
  }, [stage, contentRef]);

  const blocking = (extraction?.result?.duplicates ?? []).filter((d) => BLOCKING_DUPLICATE_KINDS.has(d.kind));
  const extractionId = state.extractionId;
  useEffect(() => {
    if (stage === 'ready' && extractionId && blocking.length === 0) {
      onClose();
      navigate(fromDocumentPath(extractionId));
    }
  }, [stage, extractionId, blocking.length, navigate, onClose]);

  async function handleBackground() {
    const ok = await continueInBackground();
    if (ok) toast.info(`We'll notify you when ${file.name} is ready`);
    else toast.error("Couldn't set up the notification — keep this window open instead.");
    if (ok) onClose();
  }

  function enterManually() {
    onClose();
    navigate(SALES_ORDER_NEW_PATH);
  }

  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-from-document-title"
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-md rounded-xl bg-white dark:bg-stone-900 p-6 shadow-2xl outline-none">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
              <FileText className="size-4 text-accent-foreground" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="create-from-document-title" className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Create Sales Order from document
              </h2>
              <p className="truncate text-xs text-stone-500 dark:text-stone-400" title={file.name}>
                {file.name} · {formatSize(file.size)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="rounded-md p-1 text-stone-500 dark:text-stone-400 transition-colors hover:bg-stone-100 dark:hover:bg-white/10 hover:text-stone-700 dark:hover:text-stone-200"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <ExtractionStepper stage={stage} failedAt={state.failedAt} />

        <div className="mt-5">
          {(stage === 'validating') && (
            <p className="text-xs text-stone-600 dark:text-stone-300">Checking your file…</p>
          )}

          {stage === 'uploading' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-300">
                <span>Uploading…</span>
                <span className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">{state.progress}%</span>
              </div>
              <progress
                value={state.progress}
                max={100}
                aria-label="Upload progress"
                className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-brand [&::-webkit-progress-bar]:bg-stone-100 dark:[&::-webkit-progress-bar]:bg-stone-700 [&::-webkit-progress-value]:bg-brand [&::-webkit-progress-value]:transition-all motion-reduce:[&::-webkit-progress-value]:transition-none"
              />
              <div className="flex justify-end">
                <button type="button" onClick={cancel} aria-label="Cancel upload" className={SECONDARY_BTN}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {stage === 'interrupted' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-xs text-stone-700 dark:text-stone-300">
                <WifiOff className="mt-0.5 size-3.5 shrink-0 text-warning dark:text-amber-400" aria-hidden="true" />
                <p>
                  <span className="font-semibold">Upload interrupted.</span>{' '}
                  {willAutoRetry(state)
                    ? offline
                      ? 'Waiting for your connection to come back…'
                      : `Retrying automatically (attempt ${state.attempt} of ${MAX_AUTO_RETRIES})…`
                    : "We couldn't finish the upload. Check your connection and try again."}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={cancel} aria-label="Cancel upload" className={SECONDARY_BTN}>
                  Cancel
                </button>
                <button type="button" onClick={retry} aria-label="Retry upload now" className={PRIMARY_BTN}>
                  Retry upload
                </button>
              </div>
            </div>
          )}

          {stage === 'reading' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300">
                <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />
                <span>Reading your document… <span className="tabular-nums">{state.elapsedSec}s</span></span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">Most documents take under {TYPICAL_READ_SECONDS} s.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={cancel} aria-label="Cancel reading" className={SECONDARY_BTN}>
                  Cancel
                </button>
                {canContinueInBackground && (
                  <button
                    type="button"
                    onClick={() => void handleBackground()}
                    aria-label="Continue in background"
                    className={PRIMARY_BTN}
                  >
                    Continue in background
                  </button>
                )}
              </div>
            </div>
          )}

          {stage === 'ready' && blocking.length > 0 && extractionId && (
            <DuplicateWarnings
              duplicates={blocking}
              onOpenExisting={(uuid) => { onClose(); navigate(salesOrderPath(uuid)); }}
              onCreateAnyway={() => {
                acknowledgeDuplicates(extractionId, blocking.flatMap((d) => (d.recordUuid ? [d.recordUuid] : [])));
                onClose();
                navigate(fromDocumentPath(extractionId));
              }}
            />
          )}

          {stage === 'ready' && blocking.length === 0 && (
            <p className="text-xs text-stone-600 dark:text-stone-300">Document ready — opening the review form…</p>
          )}

          {stage === 'failed' && state.failure && (
            <div className="space-y-3" role="alert">
              <div className="flex items-start gap-2 text-xs text-stone-700 dark:text-stone-300">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden="true" />
                <p>
                  <span className="font-semibold">We couldn't read {state.fileName || file.name}.</span>{' '}
                  {state.failure.message}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={enterManually} className={SECONDARY_BTN}>
                  Enter manually
                </button>
                {canRetryFailure(state.failure.code) && (
                  <button type="button" onClick={retry} aria-label="Retry with this document" className={PRIMARY_BTN}>
                    Retry
                  </button>
                )}
              </div>
            </div>
          )}

          {(stage === 'limit' || stage === 'aiDisabled' || stage === 'storageFull') && (
            <div className="space-y-3" role="alert">
              <div className="flex items-start gap-2 text-xs text-stone-700 dark:text-stone-300">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-warning dark:text-amber-400" aria-hidden="true" />
                <p>
                  {stage === 'limit' && "You've reached today's limit for creating orders from documents. It resets tomorrow — you can enter this order manually now."}
                  {stage === 'aiDisabled' && 'AI features are turned off for your workspace, so documents can’t be read. Enter the order manually, or ask an admin to turn them on.'}
                  {stage === 'storageFull' && 'Too many pending uploads — finish or discard some, or try later.'}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} aria-label="Close" className={SECONDARY_BTN}>
                  Close
                </button>
                <button type="button" onClick={enterManually} className={PRIMARY_BTN}>
                  Enter manually
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
