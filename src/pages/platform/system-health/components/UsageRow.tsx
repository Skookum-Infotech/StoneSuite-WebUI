import type { UsagePart } from '@/types/systemHealth';
import { METER_HIGH, METER_LOW, METER_MAX, formatUsage, meterValue } from '@/lib/systemHealth';

interface UsageRowProps {
  db: string;
  label: string;
  unit: string;
  part: UsagePart;
}

/** One usage line with a meter (amber from 80%, red from 95%). */
export function UsageRow({ db, label, unit, part }: UsageRowProps) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-stone-600 dark:text-stone-300">{label}</span>
        <span className="tabular-nums text-stone-900 dark:text-stone-100">{formatUsage(part, unit)}</span>
      </div>
      <meter
        aria-label={`${db} ${label.toLowerCase()} used`}
        className="mt-1 h-2 w-full"
        min={0}
        max={METER_MAX}
        low={METER_LOW}
        high={METER_HIGH}
        optimum={0}
        value={meterValue(part)}
      />
    </div>
  );
}
