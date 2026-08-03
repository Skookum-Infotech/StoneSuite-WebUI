import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { InventoryAlertItem } from '../mockData';

const severityBadge = {
  critical: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  low: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
} as const;

const severityLabel = { critical: 'Critical', low: 'Low' } as const;

export function InventoryAlerts({ alerts }: { alerts: InventoryAlertItem[] }) {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl border border-stone-300/70 bg-card p-6 ring-1 ring-foreground/5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-brand text-lg text-foreground">Low Stock Alerts</h2>
        <button
          type="button"
          onClick={() => navigate('/inventory/unit')}
          aria-label="View all inventory units"
          className="cursor-pointer text-xs font-semibold text-brand-dark hover:underline"
        >
          View inventory
        </button>
      </div>

      <ul className="mt-5 flex flex-col divide-y divide-stone-100 dark:divide-white/5">
        {alerts.map((alert) => (
          <li key={alert.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span
              aria-hidden="true"
              className="size-6 shrink-0 rounded-full border border-black/10 shadow-sm"
              style={{ backgroundColor: alert.swatch }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{alert.material}</p>
              <p className="text-xs text-muted-foreground">{alert.detail}</p>
            </div>
            <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-2xs font-semibold', severityBadge[alert.severity])}>
              {severityLabel[alert.severity]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
