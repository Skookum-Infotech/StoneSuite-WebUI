import { describe, it, expect } from 'vitest';
import type { ImportJobStatus } from '@/types/import';
import { IMPORT_JOB_POLL_INTERVAL_MS, importJobPollInterval, isImportJobFailed } from './importJobStatus';

describe('importJobStatus', () => {
  const cases: Array<[ImportJobStatus | undefined, boolean, number | false]> = [
    [undefined, false, IMPORT_JOB_POLL_INTERVAL_MS],
    ['pending', false, IMPORT_JOB_POLL_INTERVAL_MS],
    ['running', false, IMPORT_JOB_POLL_INTERVAL_MS],
    ['succeeded', false, false],
    ['failed', true, false],
    ['dead', true, false],
  ];

  it.each(cases)('status %s -> failed=%s, poll=%s', (status, failed, poll) => {
    expect(isImportJobFailed(status)).toBe(failed);
    expect(importJobPollInterval(status)).toBe(poll);
  });
});
