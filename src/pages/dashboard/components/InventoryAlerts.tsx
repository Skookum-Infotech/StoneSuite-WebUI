import { cn } from '@/lib/utils';
import { WidgetCard } from './WidgetCard';
import { MoreHint } from './MoreHint';
import type { InventoryAlert } from '../mockData';

const LIMIT = 4;

const SEVERITY_STYLE: Record<InventoryAlert['severity'], string> = {
  critical: 'bg-red-100 text-red-700',
  low: 'bg-amber-100 text-amber-700',
};

const SEVERITY_LABEL: Record<InventoryAlert['severity'], string> = {
  critical: 'Critical',
  low: 'Low',
};

export function InventoryAlerts({ alerts }: { alerts: InventoryAlert[] }) {
  const visible = alerts.slice(0, LIMIT);

  return (
    <WidgetCard title="Inventory alerts" subtitle="below reorder threshold">
      {alerts.length === 0 ? (
        <p className="text-xs text-stone-400">Nothing below threshold right now.</p>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-stone-100">
            {visible.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2.5 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-stone-950">{a.itemName}</div>
                  <div className="text-2xs text-stone-500">{a.warehouse}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="text-2xs text-stone-500 tabular-nums">
                    {a.quantityOnHand} / {a.reorderThreshold}
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 text-2xs font-bold', SEVERITY_STYLE[a.severity])}>
                    {SEVERITY_LABEL[a.severity]}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <MoreHint count={alerts.length - LIMIT} label="more alerts" />
        </>
      )}
    </WidgetCard>
  );
}
