import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatAlertDetail, formatStockQty } from '@/lib/inventoryAlert';
import { WidgetCard } from './WidgetCard';
import { MoreHint } from './MoreHint';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import type { InventoryAlertsData, StockAlertSeverity } from '@/types/dashboardData';

// Two visual tones cover the three severity tiers: 'short' and 'out' both
// mean there is nothing usable on hand right now (an active broken
// commitment vs. simply zero stock) and read as equally urgent, while 'low'
// is a heads-up that a configured threshold has been crossed but stock
// still exists. The badge label keeps all three tiers distinguishable even
// though the color only has two.
type AlertTone = 'critical' | 'warning';

const SEVERITY_TONE: Record<StockAlertSeverity, AlertTone> = {
  short: 'critical',
  out: 'critical',
  low: 'warning',
};

const SEVERITY_LABEL: Record<StockAlertSeverity, string> = {
  short: 'Short',
  out: 'Out',
  low: 'Low',
};

const TONE_BADGE_CLASS: Record<AlertTone, string> = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
};

// The on-hand figure itself carries the same tone as the badge -- not just
// the pill -- so the number that actually matters draws the eye first.
const TONE_VALUE_CLASS: Record<AlertTone, string> = {
  critical: 'text-red-600',
  warning: 'text-warning',
};

export function InventoryAlerts({
  data,
  isLoading,
  isError,
}: {
  data: InventoryAlertsData | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <WidgetCard title="Inventory alerts">
        <Spinner label="Loading inventory alerts…" />
      </WidgetCard>
    );
  }

  if (isError || !data) {
    return (
      <WidgetCard title="Inventory alerts">
        <ErrorNote>Couldn&apos;t load inventory alerts.</ErrorNote>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Inventory alerts" subtitle="stock needing attention">
      {data.alerts.length === 0 ? (
        <p className="text-xs text-stone-400">Nothing needs attention right now.</p>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-stone-100">
            {data.alerts.map((a) => {
              const tone = SEVERITY_TONE[a.severity];
              return (
                <div key={a.id} className="flex items-center justify-between gap-2.5 py-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => navigate(`/inventory/item/${a.id}`)}
                      aria-label={`View inventory item ${a.itemName}`}
                      className="block w-full truncate rounded text-left text-xs font-semibold text-stone-950 hover:text-accent-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {a.itemName}
                    </button>
                    <div className="text-2xs text-stone-500">{formatAlertDetail(a)}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className={cn('text-2xs font-bold tabular-nums', TONE_VALUE_CLASS[tone])}>
                      {formatStockQty(a.onHand)} on hand
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-2xs font-bold', TONE_BADGE_CLASS[tone])}>
                      {SEVERITY_LABEL[a.severity]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <MoreHint count={data.alertCount - data.alerts.length} label="more alerts" />
        </>
      )}
    </WidgetCard>
  );
}
