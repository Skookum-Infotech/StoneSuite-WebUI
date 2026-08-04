import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { ActivityItem } from '../mockData';

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl border border-stone-300/70 bg-card p-6 ring-1 ring-foreground/5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-brand text-lg text-foreground">Recent Activity</h2>
        <button
          type="button"
          onClick={() => navigate('/config/audit')}
          aria-label="View all activity in the audit log"
          className="cursor-pointer text-xs font-semibold text-brand-dark hover:underline"
        >
          View all
        </button>
      </div>

      <ul className="mt-5 flex flex-col">
        {items.map((item, i) => {
          const Icon = item.icon;
          const isLast = i === items.length - 1;
          return (
            <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="absolute left-4 top-9 h-[calc(100%-2rem)] w-px bg-stone-200 dark:bg-white/10"
                />
              )}
              <div className={cn('relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg', item.iconBg)}>
                <Icon className={cn('size-4', item.iconColor)} aria-hidden="true" />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-medium text-foreground">{item.description}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.meta} <span aria-hidden="true">·</span> {item.time}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
