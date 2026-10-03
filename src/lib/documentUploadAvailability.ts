import type { AIStatus } from '@/types/ai';

// Why "Create from document" is unavailable, named after the switch that is
// actually off, so an admin is sent to the right place.

/** The upload flow is available. */
export const UPLOAD_AVAILABLE = '';

/** The reason the upload button is disabled, '' when it is enabled, or
 *  undefined while the status is still loading (no flash of "turned off"). */
export function uploadDisabledReason(
  status: AIStatus | undefined, loading: boolean, failed: boolean,
): string | undefined {
  if (loading) return undefined;
  if (failed || !status) return "Couldn't check whether document upload is available. Refresh the page to try again.";
  if (!status.platformEnabled) return 'AI features are turned off for the platform. Ask your StoneSuite administrator to turn them on.';
  if (!status.tenantEnabled) return 'AI features are turned off for your workspace. A workspace admin can turn them on in Settings.';
  if (!status.available) return 'The AI assistant is unavailable right now. Try again later.';
  if (status.documentExtraction !== true) return "Create from document isn't enabled for your workspace yet.";
  return UPLOAD_AVAILABLE;
}
