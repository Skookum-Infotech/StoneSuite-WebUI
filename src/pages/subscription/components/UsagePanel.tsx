import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Gauge, HardDrive, Info, Sparkles } from 'lucide-react'
import { subscriptionService } from '@/services/subscriptionService'
import { apiErrorMessage } from '@/api/tenantClient'
import { relativeTime } from '@/lib/recentRecordRoute'
import {
  formatBytes, formatPeriod, formatTokenCount, groupTokenSources, usagePercent,
} from '@/lib/usageFormat'
import type { SubscriptionUsage } from '@/types/subscription'
import { UsageMeter, type UsageMeterLimit } from './UsageMeter'

const SUBSCRIPTION_USAGE_QUERY_KEY = ['subscription', 'usage'] as const
const MAX_RETRIES = 2
const HTTP_NOT_FOUND = 404
const HTTP_CLIENT_ERROR_MIN = 400
const HTTP_SERVER_ERROR_MIN = 500
const SKELETON_CARDS = ['storage', 'tokens'] as const

const isNotFound = (err: unknown) => isAxiosError(err) && err.response?.status === HTTP_NOT_FOUND

/** A 4xx (no permission, endpoint not deployed yet) won't fix itself on retry. */
function isClientError(err: unknown): boolean {
  const status = isAxiosError(err) ? err.response?.status : undefined
  return status !== undefined && status >= HTTP_CLIENT_ERROR_MIN && status < HTTP_SERVER_ERROR_MIN
}

/** Storage limits are an overall cap; token limits are per monthly period. */
function limitFor(used: number, limit: number | null, label: (limit: number) => string): UsageMeterLimit | null {
  const percent = usagePercent(used, limit)
  return percent === null || limit === null ? null : { percent, label: label(limit) }
}

function StorageMeter({ usage }: { usage: SubscriptionUsage }) {
  const { storage } = usage
  const measured = storage.measuredAt !== null
  return (
    <UsageMeter
      heading={{
        title: 'File storage',
        icon: HardDrive,
        value: measured ? formatBytes(storage.usedBytes) : '—',
        detail: measured ? `${storage.objectCount.toLocaleString()} files` : 'Not measured yet — check back shortly',
      }}
      limit={limitFor(storage.usedBytes, storage.limitBytes, (n) => `${formatBytes(n)} total`)}
    >
      <p>
        Total across your workspace
        {storage.measuredAt && <> · Updated {relativeTime(storage.measuredAt)}</>}
      </p>
    </UsageMeter>
  )
}

function TokenMeter({ usage }: { usage: SubscriptionUsage }) {
  const { aiTokens } = usage
  const rows = groupTokenSources(aiTokens.bySource)
  const period = formatPeriod(aiTokens.periodStart, aiTokens.periodEnd)
  return (
    <UsageMeter
      heading={{
        title: 'AI tokens',
        icon: Sparkles,
        value: formatTokenCount(aiTokens.totalTokens),
        detail: aiTokens.totalTokens > 0
          ? `${formatTokenCount(aiTokens.promptTokens)} input · ${formatTokenCount(aiTokens.completionTokens)} output`
          : 'No AI usage this period',
        badge: period ? `Billing cycle · ${period}` : undefined,
      }}
      limit={limitFor(aiTokens.totalTokens, aiTokens.limitTokens, (n) => `${formatTokenCount(n)} / month`)}
    >
      {rows.length > 0 && (
        <dl className="flex flex-col gap-1.5" aria-label="AI tokens by feature">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <dt>{row.label}</dt>
              <dd className="font-semibold tabular-nums text-ink">{formatTokenCount(row.totalTokens)}</dd>
            </div>
          ))}
        </dl>
      )}
    </UsageMeter>
  )
}

function renderBody(query: UseQueryResult<SubscriptionUsage>) {
  if (query.isPending) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-busy="true" aria-label="Loading usage">
        {SKELETON_CARDS.map((k) => (
          <div key={k} className="flex flex-col gap-3 rounded-xl border border-stone-200 p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-stone-200" />
            <div className="h-7 w-32 animate-pulse rounded bg-stone-200" />
            <div className="h-3 w-40 animate-pulse rounded bg-stone-100" />
          </div>
        ))}
      </div>
    )
  }
  if (query.isError) {
    const notFound = isNotFound(query.error)
    return (
      <p role={notFound ? 'status' : 'alert'} className="flex items-center gap-2 rounded-xl bg-stone-50 px-4 py-3 text-xs text-ink">
        <Info className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
        {notFound
          ? "Usage tracking isn't available for your workspace yet."
          : apiErrorMessage(query.error, "Couldn't load usage. Please try again.")}
      </p>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <StorageMeter usage={query.data} />
      <TokenMeter usage={query.data} />
    </div>
  )
}

/** Plan-tab card: overall R2 storage (a running total) and AI tokens for the
 *  current monthly billing period (which reset each period). */
export function UsagePanel() {
  const query = useQuery({
    queryKey: SUBSCRIPTION_USAGE_QUERY_KEY,
    queryFn: subscriptionService.getUsage,
    retry: (failures, err) => !isClientError(err) && failures < MAX_RETRIES,
  })
  return (
    <section aria-labelledby="usage-heading" className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/20 text-link">
            <Gauge className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="usage-heading" className="type-card-title">Usage</h2>
            <p className="mt-0.5 type-helper">Storage and AI usage for your workspace</p>
          </div>
        </div>
      </div>
      {renderBody(query)}
    </section>
  )
}
