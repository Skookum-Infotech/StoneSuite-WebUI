import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value: string;
  mono?: boolean;
  dimmed?: boolean;
};

export function TenantDetailCell({ label, value, mono = false, dimmed = false }: Props) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 bg-white px-4 py-3">
      <span className="text-2xs font-semibold uppercase tracking-wide text-stone-400">{label}</span>
      <span
        className={cn('truncate text-xs', mono ? 'font-mono' : 'font-medium', dimmed ? 'text-stone-300' : 'text-stone-700')}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
