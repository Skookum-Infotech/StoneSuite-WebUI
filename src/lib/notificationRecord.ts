// How a notification's `resource` (the kind of record it is about) reads on screen.
const RESOURCE_LABELS: Record<string, string> = {
  sales_order: 'Sales order',
  quote: 'Quote',
  estimate: 'Estimate',
  invoice: 'Invoice',
  vendor_bill: 'Vendor bill',
  install_appointment: 'Installation',
  daily_digest: 'Daily digest',
};

/** Human label for a notification's related record type ("sales_order" -> "Sales order"). */
export function notificationRecordLabel(resource: string): string {
  const known = RESOURCE_LABELS[resource];
  if (known) return known;
  const words = resource.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Record';
}

/** Full, locale-formatted date and time of a notification ("Nov 24, 2026, 9:05 AM"). */
export function formatNotificationTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
