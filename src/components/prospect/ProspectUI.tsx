import { ChevronDown } from 'lucide-react';
import { TAB_LIST_CLASS, tabClass } from '@/components/ui/tabStyles';
import { cn } from '@/lib/utils';

export const inputClass =
  'w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 outline-none placeholder:text-stone-500 focus:border-brand focus:ring-2 focus:ring-brand/20 transition disabled:bg-stone-100 disabled:text-stone-400';

/** A bordered card with the blue, collapsible-looking header used across forms. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded border border-stone-200 bg-white">
      <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2">
        <ChevronDown className="size-3 text-stone-400" />
        <h3 className="text-label font-bold uppercase tracking-wide text-stone-700">{title}</h3>
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
      <label className="block text-2xs font-semibold uppercase tracking-wide text-stone-500">
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
  tabs: { key: string; label: string }[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div role="tablist" className={cn(TAB_LIST_CLASS, "flex-wrap")}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onSelect(t.key)}
          aria-current={active === t.key}
          className={tabClass(active === t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
