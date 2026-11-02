import { cn } from '@/lib/utils';

/** One labelled figure on a Reorder card. `emphasis` marks the one that needs action. */
export function ReorderStat({ label, value, emphasis = false }: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={cn('rounded-lg px-3 py-2', emphasis ? 'bg-amber-50 text-amber-800' : 'bg-stone-50 text-stone-800')}>
      <p className={cn('text-2xs', emphasis ? 'text-amber-700' : 'text-stone-500')}>{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
