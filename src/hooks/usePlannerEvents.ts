import { useQuery } from '@tanstack/react-query';
import { invoiceService } from '@/services/invoiceService';
import { lookupService } from '@/services/lookupService';
import { salesOrderService } from '@/services/salesOrderService';
import { currencyCodeFor } from '@/lib/formatMoney';
import { PLANNER_QUERY_KEY } from '@/lib/plannerCalendar';
import { invoiceCard, scheduleEventCard } from '@/lib/plannerCards';
import type { PlannerCard } from '@/lib/plannerCards';
import type { DateRange, PlannerActivity } from '@/lib/plannerCalendar';
import type { InvoiceSummary } from '@/types/invoice';
import type { ScheduleFeedEvent } from '@/types/salesOrder';

// Same cadence as the order detail page's poll — a shared board should pick up
// a colleague's edit without a manual reload.
const PLANNER_POLL_MS = 60_000;
// A window of invoices is read a page at a time, passing the server's cursor
// straight back. Five pages of 100 comfortably covers a month; past that the
// planner is told the list was cut short rather than silently losing cards.
const INVOICE_PAGE_LIMIT = 100;
const INVOICE_MAX_PAGES = 5;

type PlannerWindow =
  | { source: 'schedule'; events: ScheduleFeedEvent[]; truncated: boolean }
  | { source: 'invoice'; invoices: InvoiceSummary[]; truncated: boolean };

async function loadWindow(activity: PlannerActivity, range: DateRange): Promise<PlannerWindow> {
  if (activity.source === 'schedule') {
    const feed = await salesOrderService.getScheduleFeed({ group: activity.group, ...range });
    return { source: 'schedule', events: feed.events, truncated: feed.truncated };
  }

  const invoices: InvoiceSummary[] = [];
  let cursor = '';
  for (let page = 0; page < INVOICE_MAX_PAGES; page += 1) {
    const res = await invoiceService.searchInvoices({
      filters: [
        { field: 'due_date', op: 'gte', value: range.from },
        { field: 'due_date', op: 'lte', value: range.to },
      ],
      limit: INVOICE_PAGE_LIMIT,
      ...(cursor ? { cursor } : {}),
    });
    invoices.push(...res.records);
    if (!res.hasMore) return { source: 'invoice', invoices, truncated: false };
    cursor = res.nextCursor;
  }
  return { source: 'invoice', invoices, truncated: true };
}

/** The job cards for one activity over one date window, soonest first inside
 *  each day. `enabled` holds the request back until the caller's permissions are
 *  known (the Invoicing tab needs `invoice:read`). */
export function usePlannerEvents(activity: PlannerActivity, range: DateRange, enabled: boolean) {
  const query = useQuery({
    queryKey: [PLANNER_QUERY_KEY, activity.key, range.from, range.to],
    queryFn: () => loadWindow(activity, range),
    enabled,
    refetchInterval: PLANNER_POLL_MS,
    // Carry the previous window across while the next loads — but only within
    // the same activity, so a tab switch never shows another activity's cards.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === activity.key ? previous : undefined,
  });

  // Amounts on invoice cards are shown in each invoice's own currency.
  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    enabled: enabled && activity.source === 'invoice',
  });

  const data = query.data;
  let cards: PlannerCard[] = [];
  if (data?.source === 'schedule') {
    const now = new Date();
    cards = data.events.map((event) => scheduleEventCard(event, now));
  } else if (data?.source === 'invoice') {
    cards = data.invoices.flatMap((invoice) => {
      const card = invoiceCard(invoice, currencyCodeFor(lookups, invoice.currencyId));
      return card ? [card] : [];
    });
  }

  return {
    cards,
    truncated: data?.truncated ?? false,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    // True while the cards on hand belong to the previous window, not the one asked for.
    isPlaceholderData: query.isPlaceholderData,
    error: query.error,
    refetch: query.refetch,
  };
}
