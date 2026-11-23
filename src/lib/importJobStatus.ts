import type { ImportJobStatus } from '@/types/import';

export const IMPORT_JOB_POLL_INTERVAL_MS = 1500;

/** True when an import job ended in failure. `dead` means the worker gave up
 *  after exhausting retries — as terminal as `failed`. */
export function isImportJobFailed(status: ImportJobStatus | undefined): boolean {
  return status === 'failed' || status === 'dead';
}

/** Polling interval for an import job: false (stop) once it is terminal. */
export function importJobPollInterval(status: ImportJobStatus | undefined): number | false {
  return status === 'succeeded' || isImportJobFailed(status) ? false : IMPORT_JOB_POLL_INTERVAL_MS;
}
