// Pure helper for the Sales orders snapshot dashboard widget
// (SalesOrdersSnapshot). The backend sends a raw daysLate offset (see
// dashboardData.ts's SalesOrderAtRisk); this turns it into the row's display
// text and whether it should draw the eye the same way the app's single
// warning accent already does elsewhere on the dashboard (see
// KpiStrip/ArOutstanding/PurchasesStatus's `text-warning` usage).

/**
 * Formats a sales order's daysLate offset (positive = overdue, negative =
 * due in the future, null = no expected delivery date set) into a short
 * label plus whether it warrants the warning tone. "Due today" is flagged
 * the same as a genuine overdue day -- there is no more slack left either
 * way.
 */
export function formatDueLabel(daysLate: number | null): { text: string; warn: boolean } {
  if (daysLate === null) return { text: 'no due date', warn: false };
  if (daysLate === 0) return { text: 'due today', warn: true };
  if (daysLate > 0) return { text: `${daysLate}d late`, warn: true };
  return { text: `due in ${-daysLate}d`, warn: false };
}
