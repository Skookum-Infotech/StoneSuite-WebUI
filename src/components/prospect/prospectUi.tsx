import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProspectTab } from '@/lib/prospectForm';

export const inputClass =
  'w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 outline-none placeholder:text-stone-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition disabled:bg-stone-100 disabled:text-stone-400';

/** A bordered card with the blue, collapsible-looking header used across forms. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded border border-stone-200 bg-white">
      <div className="flex items-center gap-2 border-b border-stone-200 bg-blue-50 px-4 py-2">
        <ChevronDown className="size-3 text-stone-400" />
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-stone-700">{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

export function FieldShell({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

/** Horizontal tab strip matching the dark-teal bar in the design. */
export function TabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: ProspectTab[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-stretch overflow-hidden rounded-t border-b-2 border-[#1f7a8c] bg-[#2c6e7f]">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onSelect(t.key)}
          aria-current={active === t.key}
          className={cn(
            'px-3 py-2 text-[11px] font-semibold transition-colors',
            active === t.key
              ? 'bg-white text-[#2c6e7f]'
              : 'text-white/90 hover:bg-white/10',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
