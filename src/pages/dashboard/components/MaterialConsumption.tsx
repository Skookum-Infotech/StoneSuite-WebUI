import { WidgetCard } from './WidgetCard';
import { MoreHint } from './MoreHint';
import type { MaterialUsage } from '../mockData';

const LIMIT = 5;

export function MaterialConsumption({ items }: { items: MaterialUsage[] }) {
  const max = Math.max(...items.map((i) => i.slabsCut), 1);
  const visible = items.slice(0, LIMIT);

  return (
    <WidgetCard title="Material consumption" subtitle="slabs cut, last 30 days">
      <div className="flex flex-col gap-[13px]">
        {visible.map((item) => (
          <div key={item.id} className="flex items-center gap-[11px]">
            <span
              className="h-[22px] w-[22px] shrink-0 rounded-md shadow-[0_0_0_1px_rgba(28,25,23,0.09)]"
              style={{ backgroundImage: item.swatch }}
              aria-hidden="true"
            />
            <span className="w-[132px] shrink-0 truncate text-xs font-medium text-stone-950">{item.name}</span>
            <div className="h-[9px] flex-1 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-brand-dark"
                style={{ width: `${(item.slabsCut / max) * 100}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs font-bold text-stone-950 tabular-nums">
              {item.slabsCut}
            </span>
          </div>
        ))}
      </div>
      <MoreHint count={items.length - LIMIT} label="more materials" />
    </WidgetCard>
  );
}
