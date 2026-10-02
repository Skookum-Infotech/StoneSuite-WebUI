const EXTRACTION_STATUS_TEXT: Record<string, string> = {
  used: 'Already used to create an order',
  attached: 'Attached to an order',
  ready: 'Waiting for review',
};

/** Human wording for a duplicate's status: extraction statuses are mapped,
 *  record statuses (e.g. "Draft") pass through unchanged. */
export function duplicateStatusText(status: string): string {
  return EXTRACTION_STATUS_TEXT[status.toLowerCase()] ?? status;
}
