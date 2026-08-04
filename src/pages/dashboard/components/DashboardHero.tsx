import { CalendarDays } from 'lucide-react';

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardHero({ name }: { name: string }) {
  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/[0.07] px-6 py-8 sm:px-10 sm:py-10"
      style={{ background: 'var(--gradient-header)' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl"
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-brand text-xs font-semibold uppercase tracking-[0.32em] text-brand/90">
            Business Snapshot
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {greeting(now.getHours())}, {name}.
          </h1>
          <p className="mt-2 max-w-md text-sm text-stone-300">
            Here&apos;s how the yard is moving today — leads, orders, and stock, all in one ledger.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 sm:self-auto">
          <CalendarDays className="size-4 text-stone-300" aria-hidden="true" />
          <span className="text-xs font-semibold text-stone-200">{dateLabel}</span>
        </div>
      </div>
    </div>
  );
}
