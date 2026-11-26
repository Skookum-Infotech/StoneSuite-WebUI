# Platform › Tenant Usage: backend handoff

This page is a frontend feature for platform admins. It lists every tenant with its
resource usage and keeps a **watch list** of tenants with unusual or excessive usage.
The UI is in this repo (`src/pages/platform/usage/`). **The backend work below belongs in
the `StoneSuite` repo.** This document is the contract the UI is built against
(`src/types/platformUsage.ts`).

Until the endpoints exist, build with `VITE_PLATFORM_USAGE_MOCK=true` to serve sample data
(`src/lib/platformUsageMock.ts`). The page then shows a "Sample data" note.

Out of scope for v1: revenue, MRR and margin. Billing is still a mockup.

## Metrics

| Metric | How the backend measures it | Notes |
|---|---|---|
| Compute hours (est.) | Request middleware sums handler wall time per tenant (tenant from the JWT); the `async_jobs` runner adds each job's run time | Neon is one project with many databases, so it cannot report compute per tenant. The UI always labels this "est." |
| DB load share | Per-tenant DB query time ÷ total DB query time | Used to split the shared Neon compute bill |
| Database storage | Daily `pg_database_size(dbName)` | `dbShareOfFleetPct` = this tenant ÷ sum of all tenants |
| Largest tables | Top 10 by `pg_total_relation_size`, with a `reltuples` row estimate | Latest snapshot only |
| R2 storage | The existing bucket measurement (bytes, objects) that `/tenant/subscription/usage` already uses | Class A/B ops can come later from the Cloudflare GraphQL `r2OperationsAdaptiveGroups` |
| AI tokens | The existing token ledger, split by source | Same sources as `AiTokenUsage.bySource` |
| Active users | Distinct users signed in during the period (`activeUsers`), out of all enabled staff users (`totalUsers`); DAU/MAU %; last sign-in | |
| API traffic | Middleware counters: requests, 5xx count, p95 latency | |
| Activity | Records created per workflow module, emails sent, automation runs | |
| Jobs | Failed and dead `async_jobs` in the last 24 hours | |

## Watch-list rules

These are evaluated after each daily rollup. An alert carries an observed value, a
baseline and a plain-English `message`, for example
"R2 storage up 211% in 7 days (132 GB → 410 GB)".

| `ruleKey` | Fires when | `severity` |
|---|---|---|
| `quota_exceeded` / `quota_near` | usage ≥ 100% / ≥ 80% of a plan limit (only when a limit is set) | critical / warning |
| `spike` | today > 28-day mean + 3σ **and** > 2× the 7-day median | warning |
| `rapid_growth` | DB or R2 storage up ≥ 50% week over week, and up ≥ 1 GB in absolute terms | warning |
| `fleet_outlier` | compute per active user above the fleet's 95th percentile | warning |
| `error_rate` | 5xx > 5% over 24 hours with ≥ 500 requests | critical |
| `failed_jobs` | any dead job, or ≥ 3 failed jobs in 24 hours | warning |
| `dormant` | an active tenant with no sign-ins for 14 days | info |

`metricKey` names the card the alert flags: `compute`, `db`, `r2`, `ai_tokens`, `users`,
`requests`, `error_rate` or `jobs`. An admin can acknowledge an alert or snooze it for 7 or
30 days. An alert resolves itself once its rule has not fired for 3 days in a row.

## Collection pipeline

```
request → usage middleware → in-memory counters per tenant
             └─ flush every 60s (one batched UPSERT) → tenant_request_hourly
async_jobs runner → job duration                      → tenant_request_hourly.job_ms

daily 02:00 UTC "usage-rollup" job (async_jobs / automation scheduler):
  1. tenant_request_hourly → tenant_usage_daily
  2. per tenant DB: pg_database_size + top tables (concurrency limit ≈ 5)
  3. R2 bytes/objects (existing measurement)
  4. active users, records created, emails, AI tokens
  5. evaluate rules → upsert tenant_usage_alerts
```

The middleware only increments counters in memory, so it adds no database write per
request.

## Tables (platform DB)

- `tenant_request_hourly(tenant_id, hour, requests, errors_5xx, handler_ms, db_ms, job_ms, p95_ms)`, kept 90 days.
- `tenant_usage_daily(tenant_id, day, metric_key, value NUMERIC, PRIMARY KEY (tenant_id, day, metric_key))`, kept 13 months. Stored long-form, so a new metric needs no migration.
- `tenant_table_sizes(tenant_id, measured_at, table_name, total_bytes, row_estimate)`, latest snapshot only.
- `tenant_usage_alerts(id, tenant_id, rule_key, metric_key, severity, observed, baseline, message, detail, first_seen_at, last_seen_at, status, acted_by, snoozed_until)`, where `status` is `open | acked | snoozed | resolved`.

## API

All endpoints are platform-admin only and use the usual `{ success, … }` envelope. Sizes
are bytes, compute is hours, and dates are ISO 8601 (series days are `yyyy-mm-dd`, UTC).
A metric that hasn't been measured yet is `null`, never `0`. "Prev" fields cover the
previous period of equal length.

### `GET /api/platform/usage/overview?period=7d|30d|90d&limit=&cursor=`

```jsonc
{
  "success": true,
  "generatedAt": "2026-11-25T02:10:00Z",
  "period": "30d",
  "fleet": {                      // FleetTotals, identical on every page
    "activeTenants": 8, "totalTenants": 10,
    "computeHours": 175.2, "computeHoursPrev": 168.0,
    "dbBytes": 37902090240, "dbBytesPrev": 36500000000,
    "r2Bytes": 1060856627200, "r2BytesPrev": 735000000000,
    "aiTokens": 8100000, "aiTokensPrev": 7900000,
    "computeTrend": [5.1, 5.6]     // daily, oldest first
  },
  "tenants": [ /* TenantUsageRow, one per tenant */ ],
  "nextCursor": "opaque"          // keyset; omitted on the last page
}
```

`TenantUsageRow` fields: `tenantId`, `slug`, `displayName`, `status`, `activeUsers`,
`totalUsers`, `computeHours`, `computeHoursPrev`, `dbBytes`, `dbBytesPrev`, `r2Bytes`,
`r2BytesPrev`, `aiTokens`, `aiTokensPrev`, `errorRatePct`, `errorRate24hPct`,
`computeTrend[]` and `topSeverity` (`critical | warning | info | null`, the tenant's highest
open alert).

### `GET /api/platform/usage/watchlist`

Returns `{ success, alerts: UsageAlert[] }`: open alerts, plus snoozed alerts whose snooze
has expired. `UsageAlert` fields: `id`, `tenantId`, `tenantName`, `ruleKey`, `metricKey`,
`severity`, `message`, `detail?`, `firstSeenAt`, `lastSeenAt`, `status` and
`snoozedUntil?`.

### `GET /api/platform/usage/tenants/{tenantId}?period=`

Returns `{ success, generatedAt, period, tenant: TenantUsageRow, metrics, series,
topTables, topTablesMeasuredAt, activity, alerts }`:

- `metrics`: `computeRequestHours`, `computeJobHours`, `dbShareOfFleetPct`, `r2Objects`,
  `aiTokensBySource[{source, totalTokens}]`, `dauMauPct`, `lastSignInAt`, `requests`,
  `requestsPrev`, `p95LatencyMs`, `failedJobs`, `deadJobs`
- `series[]`: `{ date, computeRequestHours, computeJobHours, dbBytes, r2Bytes }`, one per day
- `topTables[]`: `{ tableName, totalBytes, rowEstimate }`, largest first
- `activity`: `{ recordsByModule[{label, count}], emailsSent, automationRuns }`
- `alerts[]`: every alert from the last 90 days, in any status

A tenant that doesn't exist **or** isn't visible to the caller returns **404**. The UI
shows "Usage isn't available for this tenant" and never says which case it was.

### `POST /api/platform/usage/alerts/{alertId}/ack`

The body is `{}` to acknowledge, or `{ "snoozeDays": 7 | 30 }` to snooze. It returns
`{ success: true }`.
