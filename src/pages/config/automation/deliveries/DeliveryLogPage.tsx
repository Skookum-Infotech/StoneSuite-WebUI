import { isAxiosError } from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { AccessDenied } from '@/components/PermissionGuard';
import { EmptyState, ErrorNote, PageHeader } from '@/components/tenant/ui';
import { AUTOMATION_RULES_QUERY_KEY } from '@/hooks/useAutomationKillSwitch';
import { isDeliveryStatus } from '@/lib/automationDeliveries';
import { automationDeliveryService } from '@/services/automationDeliveryService';
import { automationRuleService } from '@/services/automationRuleService';
import type { AutomationDeliveryFilters, DeliveryStatus } from '@/types/automationDelivery';
import { DeliveryFilters } from './DeliveryFilters';
import { DELIVERY_GRID, DeliveryRow } from './DeliveryRow';

const DELIVERIES_QUERY_KEY = 'automation-deliveries';
const SKELETON_ROWS = 5;
const HTTP_FORBIDDEN = 403;
const HTTP_BAD_REQUEST = 400;
const HEADERS = [
  'Created', 'Rule', 'Document', 'Recipient', 'Stage', 'Status', 'Reason', 'Scheduled for', 'Sent at', 'Attempts',
];
const BAD_CURSOR_MESSAGE = 'The list changed while you were paging. Showing the first page again.';
const BUTTON_CLASS =
  'rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200';

function httpStatus(err: unknown): number | undefined {
  return isAxiosError(err) ? err.response?.status : undefined;
}

function SkeletonRows() {
  return (
    <ul aria-busy="true" aria-label="Loading automated emails">
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <li key={i} className="flex flex-col gap-2 border-b border-stone-100 p-4 last:border-b-0 dark:border-stone-800">
          <div className="h-3 w-40 animate-pulse rounded bg-stone-100 dark:bg-stone-800" />
          <div className="h-3 w-64 max-w-full animate-pulse rounded bg-stone-100 dark:bg-stone-800" />
        </li>
      ))}
    </ul>
  );
}

/** Configure → Automation → Deliveries: read-only log of every automated email planned, sent or skipped. */
export default function DeliveryLogPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const rawStatus = params.get('status');
  const status: DeliveryStatus | undefined = isDeliveryStatus(rawStatus) ? rawStatus : undefined;
  const ruleKey = params.get('ruleKey') || undefined;
  const filters: AutomationDeliveryFilters = { status, ruleKey };
  const filtered = status !== undefined || ruleKey !== undefined;

  const rulesQ = useQuery({
    queryKey: [AUTOMATION_RULES_QUERY_KEY],
    queryFn: () => automationRuleService.list(),
  });
  const rules = rulesQ.data ?? [];

  // The filters are part of the key, so changing one starts again from the first page.
  const queryKey = [DELIVERIES_QUERY_KEY, status ?? '', ruleKey ?? ''];
  const q = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => automationDeliveryService.list(filters, pageParam || undefined),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor || undefined,
    retry: false,
  });

  const setFilter = (key: 'status' | 'ruleKey', value: string | undefined): void => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  const clearFilters = (): void => setParams(new URLSearchParams());

  const loadMore = async (): Promise<void> => {
    const result = await q.fetchNextPage();
    if (result.isError && httpStatus(result.error) === HTTP_BAD_REQUEST) {
      toast.error(BAD_CURSOR_MESSAGE);
      await queryClient.resetQueries({ queryKey });
    }
  };

  if (httpStatus(q.error) === HTTP_FORBIDDEN) return <AccessDenied />;

  const rows = q.data?.pages.flatMap((p) => p.deliveries) ?? [];
  const ruleByKey = new Map(rules.map((r) => [r.ruleKey, r]));
  const showEmpty = !q.isLoading && !q.isError && rows.length === 0;

  return (
    <div className="p-6 3xl:p-10 4xl:p-14">
      <PageHeader
        title="Automated emails"
        subtitle="Every reminder StoneSuite planned, sent or skipped on your behalf."
        action={
          <Link to="/config/automation" className="text-xs font-medium text-brand-dark underline-offset-2 hover:underline">
            Back to Automation
          </Link>
        }
      />
      <DeliveryFilters
        status={status}
        ruleKey={ruleKey}
        rules={rules}
        onStatus={(s) => setFilter('status', s)}
        onRuleKey={(k) => setFilter('ruleKey', k)}
      />
      {q.isError && !q.data ? (
        <div className="flex flex-wrap items-center gap-3">
          <ErrorNote>{apiErrorMessage(q.error, 'Could not load automated emails.')}</ErrorNote>
          <button type="button" aria-label="Retry loading automated emails" onClick={() => q.refetch()} className={BUTTON_CLASS}>
            Retry
          </button>
        </div>
      ) : showEmpty ? (
        <EmptyState>
          {filtered ? (
            <>
              <p>Nothing matches these filters.</p>
              <button type="button" aria-label="Clear filters" onClick={clearFilters} className={`${BUTTON_CLASS} mt-3`}>
                Clear filters
              </button>
            </>
          ) : (
            'No automated emails yet.'
          )}
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          <div
            aria-hidden="true"
            className={`hidden border-b border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold text-stone-500 dark:border-stone-800 dark:bg-stone-900 ${DELIVERY_GRID}`}
          >
            {HEADERS.map((h) => (
              <span key={h} className="text-center">
                {h}
              </span>
            ))}
          </div>
          {q.isLoading ? (
            <SkeletonRows />
          ) : (
            <ul aria-label="Automated emails">
              {rows.map((d) => (
                <DeliveryRow
                  key={d.id}
                  delivery={d}
                  ruleName={ruleByKey.get(d.ruleKey)?.name ?? d.ruleKey}
                  cadenceLength={ruleByKey.get(d.ruleKey)?.cadence.length}
                />
              ))}
            </ul>
          )}
        </div>
      )}
      {q.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            aria-label="Load more"
            disabled={q.isFetchingNextPage}
            onClick={loadMore}
            className={BUTTON_CLASS}
          >
            {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
