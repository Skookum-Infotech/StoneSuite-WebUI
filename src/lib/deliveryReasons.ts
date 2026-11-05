/** Reason codes the backend writes on skipped/cancelled deliveries → customer-facing copy. */
export const DELIVERY_REASON_COPY: Readonly<Record<string, string>> = {
  kill_switch: 'Paused by workspace switch',
  cap: 'Daily or weekly limit reached (will retry)',
  suppressed: 'Address on do-not-email list',
  stale: 'Too old to send',
  superseded: 'Replaced by a newer reminder',
  rule_disabled: 'Rule turned off',
  pre_enable: 'Before the rule was turned on',
  paid: 'Invoice paid',
  voided: 'Document voided or deleted',
  not_sent: 'Document no longer Sent',
  not_pending: 'No longer awaiting approval',
  converted: 'Converted',
  no_email: 'No email address',
  do_not_contact: 'Customer marked do-not-contact',
  ar_hold: 'Customer on AR hold',
  credit_covers: 'Covered by credit',
  anchor_changed: 'Details changed; replanned',
  recipient_changed: 'Details changed; replanned',
  owner_changed: 'Details changed; replanned',
  not_rendered: 'Email could not be prepared',
};

/** Copy for a reason code; an unknown code renders raw so new backend reasons stay visible. */
export function deliveryReasonLabel(reason: string | null | undefined): string {
  if (!reason) return '';
  return DELIVERY_REASON_COPY[reason] ?? reason;
}
