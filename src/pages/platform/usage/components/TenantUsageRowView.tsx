import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatBytes, formatComputeHours, formatTokenCount } from '@/lib/usageFormat';
import { NOTABLE_CHANGE_PCT, SEVERITY_LABEL, percentChange } from '@/lib/usageWatchlist';
import { KpiSparkline } from '@/pages/dashboard/components/KpiSparkline';
import type { TenantUsageRow } from '@/types/platformUsage';
import { SeverityDot } from './SeverityDot';
import { TenantAvatar } from './TenantAvatar';
import { UsageBar } from './UsageBar';
import { UsageStatus } from './UsageStatus';
import { usageDetailPath } from './usagePaths';

/** Above this 24-hour error rate the cell shows the 24h figure in red. */
export const ERROR_RATE_ALERT_PCT = 5;
const SPARK_COLOR = '#719c3b';
const SPARK_ALERT_COLOR = '#dc2626';

const DASH = <span className="text-stone-400">—</span>;
const CELL = 'px-2.5 py-2.5';
const NUM_CELL = `${CELL} text-right tabular-nums`;

function Seats({ row }: { row: TenantUsageRow }) {
  if (row.totalUsers === 0) return DASH;
  return (
    <span className="inline-flex min-w-16 flex-col gap-1">
      <span className="tabular-nums">
        {row.activeUsers} / {row.totalUsers}
      </span>
      <UsageBar value={row.activeUsers} max={row.totalUsers} label={`${row.activeUsers} of ${row.totalUsers} users active`} />
    </span>
  );
}

function ErrorCell({ row }: { row: TenantUsageRow }) {
  if (row.errorRatePct === null) return <td className={NUM_CELL}>{DASH}</td>;
  const hot = (row.errorRate24hPct ?? 0) > ERROR_RATE_ALERT_PCT;
  return (
    <td className={cn(NUM_CELL, hot && 'font-semibold text-red-600')}>
      {hot ? `${row.errorRate24hPct?.toFixed(1)}% 24h` : `${row.errorRatePct.toFixed(1)}%`}
    </td>
  );
}

/** One tenant in the usage table. The whole row opens the tenant's detail. */
export function TenantUsageRowView({ row }: { row: TenantUsageRow }) {
  const navigate = useNavigate();
  const open = () => navigate(usageDetailPath(row.tenantId));
  const onKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };
  const r2Jump = percentChange(row.r2Bytes, row.r2BytesPrev);
  const alertText = row.topSeverity ? `${SEVERITY_LABEL[row.topSeverity]} alert` : 'No open alerts';

  return (
    <tr
      tabIndex={0}
      aria-label={`Open usage for ${row.displayName}`}
      onClick={open}
      onKeyDown={onKeyDown}
      className="cursor-pointer border-b border-stone-100 text-sm last:border-b-0 hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline-none"
    >
      <td className={CELL}>
        <div className="flex items-center gap-2.5">
          <TenantAvatar name={row.displayName} status={row.status} />
          <div className="min-w-0">
            <span className="block font-semibold text-stone-900">{row.displayName}</span>
            <span className="block font-mono text-2xs text-stone-500">{row.slug}</span>
          </div>
        </div>
      </td>
      <td className={CELL}>
        <UsageStatus status={row.status} />
      </td>
      <td className={CELL}>
        <Seats row={row} />
      </td>
      <td className={NUM_CELL}>{row.computeHours === null ? DASH : formatComputeHours(row.computeHours)}</td>
      <td className={NUM_CELL}>{row.dbBytes === null ? DASH : formatBytes(row.dbBytes)}</td>
      <td className={NUM_CELL}>
        {row.r2Bytes === null ? DASH : formatBytes(row.r2Bytes)}
        {r2Jump !== null && r2Jump >= NOTABLE_CHANGE_PCT && (
          <span className="ml-1 text-xs font-semibold text-warning">▲{Math.round(r2Jump)}%</span>
        )}
      </td>
      <td className={NUM_CELL}>{row.aiTokens === null ? DASH : formatTokenCount(row.aiTokens)}</td>
      <ErrorCell row={row} />
      <td className={CELL}>
        {row.computeTrend.length > 1 ? (
          <KpiSparkline
            points={row.computeTrend}
            color={row.topSeverity === 'critical' ? SPARK_ALERT_COLOR : SPARK_COLOR}
          />
        ) : (
          DASH
        )}
      </td>
      <td className={`${CELL} text-center`}>
        <SeverityDot severity={row.topSeverity} label={alertText} />
      </td>
    </tr>
  );
}
