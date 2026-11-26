import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAckUsageAlert } from '@/hooks/useAckUsageAlert';
import type { SnoozeDays, UsageAlert } from '@/types/platformUsage';

const OPTIONS: { label: string; snoozeDays?: SnoozeDays }[] = [
  { label: 'Acknowledge' },
  { label: 'Snooze for 7 days', snoozeDays: 7 },
  { label: 'Snooze for 30 days', snoozeDays: 30 },
];

const ITEM_CLASS =
  'w-full rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-stone-700 hover:bg-stone-100 focus-visible:bg-stone-100 focus-visible:outline-none';

/** "Ack ▾" button: acknowledge the alert, or snooze it for 7 or 30 days. */
export function AckAlertMenu({ alert }: { alert: UsageAlert }) {
  const [open, setOpen] = useState(false);
  const ack = useAckUsageAlert();

  const choose = (snoozeDays?: SnoozeDays) => {
    setOpen(false);
    ack.mutate({ alertId: alert.id, snoozeDays });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={ack.isPending}
          aria-label={`Acknowledge or snooze the ${alert.tenantName} alert`}
          className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-label font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          {ack.isPending ? 'Saving…' : 'Ack'}
          <ChevronDown className="size-3" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1" aria-label="Alert actions">
        <div className="flex flex-col">
          {OPTIONS.map((o) => (
            <button key={o.label} type="button" className={ITEM_CLASS} onClick={() => choose(o.snoozeDays)}>
              {o.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
