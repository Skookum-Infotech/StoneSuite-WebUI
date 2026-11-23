import type { ExtractionFailureCode, ExtractionStatus } from '@/types/documentExtraction';

/** Stages of the create-from-document flow, in the order a happy path visits them. */
export type ExtractionStage =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'interrupted'
  | 'reading'
  | 'ready'
  | 'failed'
  | 'limit'
  | 'aiDisabled'
  | 'storageFull'
  | 'cancelled';

/** Automatic upload retries before the user has to press Retry. */
export const MAX_AUTO_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_FACTOR = 2;
/** Seconds of reading before "Continue in background" is offered. */
export const BACKGROUND_OFFER_SECONDS = 10;
/** Poll interval while the server is still working. */
export const POLL_INTERVAL_MS = 1500;

/** Where in the flow a failure happened — drives which stepper step shows the error. */
export type FailedAt = 'upload' | 'read';

export interface ExtractionFailure {
  code: ExtractionFailureCode;
  message: string;
}

export interface ExtractionState {
  stage: ExtractionStage;
  fileName: string;
  extractionId: string | null;
  /** Upload progress, 0-100. */
  progress: number;
  /** Failed upload attempts since the last manual (re)start. */
  attempt: number;
  /** Seconds spent in the reading stage. */
  elapsedSec: number;
  failure: ExtractionFailure | null;
  failedAt: FailedAt | null;
}

export type ExtractionEvent =
  | { type: 'PICK'; fileName: string }
  | { type: 'CREATED'; id: string }
  | { type: 'PROGRESS'; pct: number }
  | { type: 'UPLOAD_FAILED'; retryable: boolean; message?: string }
  | { type: 'RETRY_UPLOAD' }
  | { type: 'MANUAL_RETRY' }
  | { type: 'START_OK' }
  | { type: 'START_MISSING' }
  | { type: 'POLLED'; status: ExtractionStatus; failureCode?: ExtractionFailureCode; failureMessage?: string }
  | { type: 'EXPIRED' }
  | { type: 'TICK'; elapsedSec: number }
  | { type: 'FAIL'; code: ExtractionFailureCode; message: string; at: FailedAt }
  | { type: 'LIMIT' }
  | { type: 'AI_DISABLED' }
  | { type: 'STORAGE_FULL' }
  | { type: 'CANCEL' }
  | { type: 'RESET' };

export const initialExtractionState: ExtractionState = {
  stage: 'idle',
  fileName: '',
  extractionId: null,
  progress: 0,
  attempt: 0,
  elapsedSec: 0,
  failure: null,
  failedAt: null,
};

const STORAGE_UNAVAILABLE_MESSAGE =
  'Storage is unavailable for your workspace — contact your admin.';
const UPLOAD_MISSING_MESSAGE = "The upload didn't finish — retry.";
const EXPIRED_MESSAGE = 'This document expired after 24 hours. Upload it again.';

const FAILURE_MESSAGES: Record<string, string> = {
  corrupt: "This file looks damaged and couldn't be opened.",
  scanned: "This looks like a scanned image — we can only read PDFs and Word files with real text.",
  unreadable_text: "The text in this file couldn't be read.",
  password_protected: 'This file is password protected. Remove the password and upload it again.',
  unsupported_encryption: "This file uses an encryption type we can't open.",
  page_cap: 'This document has too many pages.',
  line_cap: 'This document has too many line items.',
  too_large: 'This file is too large.',
  unsupported_type: 'Only PDF and Word (.docx) files are supported.',
  empty: 'This file has no readable content.',
  upload_corrupted: 'The file was damaged during upload. Retry the upload.',
  upload_missing: UPLOAD_MISSING_MESSAGE,
  storage_unavailable: STORAGE_UNAVAILABLE_MESSAGE,
  expired: EXPIRED_MESSAGE,
};
const GENERIC_FAILURE_MESSAGE = "We couldn't read this document.";

/** The text shown for a failure: the server's own message when it sent one,
 *  otherwise a client-side message per failure code. */
export function failureText(code: ExtractionFailureCode | undefined, serverMessage?: string): string {
  if (serverMessage) return serverMessage;
  return (code && FAILURE_MESSAGES[code]) || GENERIC_FAILURE_MESSAGE;
}

/** Failure codes caused by the file itself (or the workspace), where uploading
 *  the same file again can't help — only "Enter manually" is offered. */
const TERMINAL_FAILURE_CODES: ReadonlySet<string> = new Set([
  'corrupt', 'scanned', 'unreadable_text', 'password_protected', 'unsupported_encryption',
  'page_cap', 'line_cap', 'too_large', 'unsupported_type', 'empty', 'storage_unavailable', 'used', 'invalid_file',
]);

/** Whether "Retry" should be offered for a failure with this code. */
export function canRetryFailure(code: ExtractionFailureCode | undefined): boolean {
  return !code || !TERMINAL_FAILURE_CODES.has(code);
}

/** Delay before automatic retry number `attempt` (1-based): 1 s, 2 s, 4 s. */
export function retryDelayMs(attempt: number): number {
  return BACKOFF_BASE_MS * BACKOFF_FACTOR ** Math.max(0, attempt - 1);
}

/** Whether the upload is interrupted with automatic retries still left. */
export function willAutoRetry(state: ExtractionState): boolean {
  return state.stage === 'interrupted' && state.attempt <= MAX_AUTO_RETRIES;
}

function failed(state: ExtractionState, code: ExtractionFailureCode, message: string, at: FailedAt): ExtractionState {
  return { ...state, stage: 'failed', failure: { code, message }, failedAt: at };
}

/** Pure transition function for the create-from-document flow. */
export function extractionReducer(state: ExtractionState, event: ExtractionEvent): ExtractionState {
  switch (event.type) {
    case 'PICK':
      return { ...initialExtractionState, stage: 'validating', fileName: event.fileName };
    case 'CREATED':
      return { ...state, stage: 'uploading', extractionId: event.id, progress: 0, attempt: 0 };
    case 'PROGRESS':
      return state.stage === 'uploading' ? { ...state, progress: event.pct } : state;
    case 'UPLOAD_FAILED':
      if (state.stage !== 'uploading') return state;
      if (!event.retryable) {
        return failed(state, 'storage_unavailable', event.message ?? STORAGE_UNAVAILABLE_MESSAGE, 'upload');
      }
      return { ...state, stage: 'interrupted', attempt: state.attempt + 1, progress: 0 };
    case 'RETRY_UPLOAD':
      return state.stage === 'interrupted' ? { ...state, stage: 'uploading', progress: 0 } : state;
    case 'MANUAL_RETRY':
      if (state.stage === 'interrupted' || (state.stage === 'failed' && state.failedAt === 'upload')) {
        return { ...state, stage: 'uploading', progress: 0, attempt: 0, failure: null, failedAt: null };
      }
      return state;
    case 'START_OK':
      return state.stage === 'uploading'
        ? { ...state, stage: 'reading', progress: 100, elapsedSec: 0 }
        : state;
    case 'START_MISSING':
      return state.stage === 'uploading'
        ? { ...state, stage: 'interrupted', attempt: state.attempt + 1, progress: 0 }
        : state;
    case 'POLLED':
      if (state.stage !== 'reading') return state;
      if (event.status === 'ready') return { ...state, stage: 'ready' };
      if (event.status === 'failed') {
        return failed(
          state,
          event.failureCode ?? 'unknown',
          failureText(event.failureCode, event.failureMessage),
          event.failureCode === 'upload_corrupted' ? 'upload' : 'read',
        );
      }
      if (event.status === 'used' || event.status === 'attached') {
        return failed(state, 'used', 'This document was already used to create a record.', 'read');
      }
      if (event.status === 'discarded') return { ...state, stage: 'cancelled' };
      return state;
    case 'EXPIRED':
      return failed(state, 'expired', EXPIRED_MESSAGE, 'read');
    case 'TICK':
      return state.stage === 'reading' ? { ...state, elapsedSec: event.elapsedSec } : state;
    case 'FAIL':
      return failed(state, event.code, event.message, event.at);
    case 'LIMIT':
      return { ...state, stage: 'limit' };
    case 'AI_DISABLED':
      return { ...state, stage: 'aiDisabled' };
    case 'STORAGE_FULL':
      return { ...state, stage: 'storageFull' };
    case 'CANCEL':
      return { ...state, stage: 'cancelled' };
    case 'RESET':
      return initialExtractionState;
  }
}

export type StepKey = 'upload' | 'read' | 'match' | 'review';
export type StepStatus = 'complete' | 'current' | 'pending' | 'error';

export const STEP_ORDER: readonly StepKey[] = ['upload', 'read', 'match', 'review'];

/** Per-step status for the stepper. "Match" runs server-side inside the read,
 *  so it only completes with the result; "Review" is the next screen. */
export function stepStatuses(state: Pick<ExtractionState, 'stage' | 'failedAt'>): Record<StepKey, StepStatus> {
  const s: Record<StepKey, StepStatus> = { upload: 'pending', read: 'pending', match: 'pending', review: 'pending' };
  switch (state.stage) {
    case 'validating':
    case 'uploading':
    case 'interrupted':
      s.upload = 'current';
      break;
    case 'reading':
      s.upload = 'complete';
      s.read = 'current';
      break;
    case 'ready':
      s.upload = 'complete';
      s.read = 'complete';
      s.match = 'complete';
      s.review = 'current';
      break;
    case 'failed':
      if (state.failedAt === 'upload') {
        s.upload = 'error';
      } else {
        s.upload = 'complete';
        s.read = 'error';
      }
      break;
    default:
      break;
  }
  return s;
}
