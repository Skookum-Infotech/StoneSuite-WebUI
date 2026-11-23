import { describe, it, expect } from 'vitest';
import {
  MAX_AUTO_RETRIES,
  canRetryFailure,
  extractionReducer,
  failureText,
  initialExtractionState,
  retryDelayMs,
  stepStatuses,
  willAutoRetry,
  type ExtractionEvent,
  type ExtractionState,
} from './documentExtractionMachine';

const st = (over: Partial<ExtractionState>): ExtractionState => ({ ...initialExtractionState, ...over });

describe('extractionReducer', () => {
  const cases: Array<{ name: string; from: ExtractionState; event: ExtractionEvent; expected: Partial<ExtractionState> }> = [
    { name: 'pick starts validating', from: initialExtractionState, event: { type: 'PICK', fileName: 'po.pdf' }, expected: { stage: 'validating', fileName: 'po.pdf' } },
    { name: 'created starts uploading', from: st({ stage: 'validating' }), event: { type: 'CREATED', id: 'x1' }, expected: { stage: 'uploading', extractionId: 'x1', progress: 0, attempt: 0 } },
    { name: 'progress updates while uploading', from: st({ stage: 'uploading' }), event: { type: 'PROGRESS', pct: 42 }, expected: { progress: 42 } },
    { name: 'progress ignored outside uploading', from: st({ stage: 'reading' }), event: { type: 'PROGRESS', pct: 42 }, expected: { progress: 0 } },
    { name: 'retryable upload failure interrupts and counts', from: st({ stage: 'uploading', progress: 60 }), event: { type: 'UPLOAD_FAILED', retryable: true }, expected: { stage: 'interrupted', attempt: 1, progress: 0 } },
    { name: 'R2 4xx fails without retry', from: st({ stage: 'uploading' }), event: { type: 'UPLOAD_FAILED', retryable: false }, expected: { stage: 'failed', failedAt: 'upload', failure: { code: 'storage_unavailable', message: 'Storage is unavailable for your workspace — contact your admin.' } } },
    { name: 'auto retry resumes uploading', from: st({ stage: 'interrupted', attempt: 1 }), event: { type: 'RETRY_UPLOAD' }, expected: { stage: 'uploading', attempt: 1 } },
    { name: 'manual retry resets attempts', from: st({ stage: 'interrupted', attempt: 4 }), event: { type: 'MANUAL_RETRY' }, expected: { stage: 'uploading', attempt: 0 } },
    { name: 'start ok moves to reading', from: st({ stage: 'uploading' }), event: { type: 'START_OK' }, expected: { stage: 'reading', progress: 100, elapsedSec: 0 } },
    { name: 'start finding no object interrupts', from: st({ stage: 'uploading' }), event: { type: 'START_MISSING' }, expected: { stage: 'interrupted', attempt: 1 } },
    { name: 'poll running keeps reading', from: st({ stage: 'reading' }), event: { type: 'POLLED', status: 'running' }, expected: { stage: 'reading' } },
    { name: 'poll ready', from: st({ stage: 'reading' }), event: { type: 'POLLED', status: 'ready' }, expected: { stage: 'ready' } },
    { name: 'poll failed uses server message', from: st({ stage: 'reading' }), event: { type: 'POLLED', status: 'failed', failureCode: 'scanned', failureMessage: 'Scanned PDF' }, expected: { stage: 'failed', failedAt: 'read', failure: { code: 'scanned', message: 'Scanned PDF' } } },
    { name: 'poll failed falls back to code message', from: st({ stage: 'reading' }), event: { type: 'POLLED', status: 'failed', failureCode: 'password_protected' }, expected: { stage: 'failed', failure: { code: 'password_protected', message: failureText('password_protected') } } },
    { name: 'upload_corrupted failure is an upload failure', from: st({ stage: 'reading' }), event: { type: 'POLLED', status: 'failed', failureCode: 'upload_corrupted' }, expected: { stage: 'failed', failedAt: 'upload' } },
    { name: 'poll used is a failure', from: st({ stage: 'reading' }), event: { type: 'POLLED', status: 'used' }, expected: { stage: 'failed', failure: { code: 'used', message: 'This document was already used to create a record.' } } },
    { name: 'poll ignored when not reading', from: st({ stage: 'cancelled' }), event: { type: 'POLLED', status: 'ready' }, expected: { stage: 'cancelled' } },
    { name: 'expired', from: st({ stage: 'reading' }), event: { type: 'EXPIRED' }, expected: { stage: 'failed', failure: { code: 'expired', message: 'This document expired after 24 hours. Upload it again.' } } },
    { name: 'tick sets elapsed while reading', from: st({ stage: 'reading' }), event: { type: 'TICK', elapsedSec: 12 }, expected: { elapsedSec: 12 } },
    { name: 'tick ignored otherwise', from: st({ stage: 'uploading' }), event: { type: 'TICK', elapsedSec: 12 }, expected: { elapsedSec: 0 } },
    { name: 'limit', from: st({ stage: 'validating' }), event: { type: 'LIMIT' }, expected: { stage: 'limit' } },
    { name: 'ai disabled', from: st({ stage: 'validating' }), event: { type: 'AI_DISABLED' }, expected: { stage: 'aiDisabled' } },
    { name: 'storage full', from: st({ stage: 'validating' }), event: { type: 'STORAGE_FULL' }, expected: { stage: 'storageFull' } },
    { name: 'cancel', from: st({ stage: 'uploading' }), event: { type: 'CANCEL' }, expected: { stage: 'cancelled' } },
    { name: 'reset', from: st({ stage: 'failed', fileName: 'a.pdf' }), event: { type: 'RESET' }, expected: initialExtractionState },
  ];

  it.each(cases)('$name', ({ from, event, expected }) => {
    expect(extractionReducer(from, event)).toMatchObject(expected);
  });

  it('exhausts auto retries after MAX_AUTO_RETRIES failures', () => {
    let s = st({ stage: 'uploading' });
    for (let i = 1; i <= MAX_AUTO_RETRIES; i++) {
      s = extractionReducer(s, { type: 'UPLOAD_FAILED', retryable: true });
      expect(willAutoRetry(s)).toBe(true);
      s = extractionReducer(s, { type: 'RETRY_UPLOAD' });
    }
    s = extractionReducer(s, { type: 'UPLOAD_FAILED', retryable: true });
    expect(s.stage).toBe('interrupted');
    expect(willAutoRetry(s)).toBe(false);
  });
});

describe('retryDelayMs', () => {
  it.each([[1, 1000], [2, 2000], [3, 4000]])('attempt %i waits %i ms', (attempt, ms) => {
    expect(retryDelayMs(attempt)).toBe(ms);
  });
});

describe('canRetryFailure', () => {
  it.each([
    ['upload_corrupted', true], ['upload_missing', true], ['unknown', true], [undefined, true],
    ['scanned', false], ['password_protected', false], ['storage_unavailable', false], ['invalid_file', false],
  ] as const)('%s -> %s', (code, expected) => {
    expect(canRetryFailure(code)).toBe(expected);
  });
});

describe('stepStatuses', () => {
  it.each([
    ['uploading', null, { upload: 'current', read: 'pending', match: 'pending', review: 'pending' }],
    ['reading', null, { upload: 'complete', read: 'current', match: 'pending', review: 'pending' }],
    ['ready', null, { upload: 'complete', read: 'complete', match: 'complete', review: 'current' }],
    ['failed', 'upload', { upload: 'error', read: 'pending', match: 'pending', review: 'pending' }],
    ['failed', 'read', { upload: 'complete', read: 'error', match: 'pending', review: 'pending' }],
    ['idle', null, { upload: 'pending', read: 'pending', match: 'pending', review: 'pending' }],
  ] as const)('%s / %s', (stage, failedAt, expected) => {
    expect(stepStatuses({ stage, failedAt })).toEqual(expected);
  });
});
