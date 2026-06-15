import { cn } from '@/lib/utils';

export const fieldCls =
  'w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-800 outline-none placeholder:text-stone-300 focus:border-stone-400 focus:ring-2 focus:ring-stone-900/5 transition-all duration-150 disabled:bg-stone-50 disabled:text-stone-400 hover:border-stone-300';

const SECTION_ACCENTS: Record<string, string> = {
  'Primary Information': 'bg-purple-400',
  'Contact Details': 'bg-blue-400',
  'Classification & Terms': 'bg-amber-400',
  'Custom Fields': 'bg-emerald-400',
};

export function ModernSection({ title, children }: { title: string; children: React.ReactNode }) {
  const accent = SECTION_ACCENTS[title] ?? 'bg-stone-400';
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-stone-100">
        <div className={cn('w-1 h-4 rounded-full shrink-0', accent)} />
        <h3 className="text-xs font-semibold text-stone-700">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export function ModernFieldShell({
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
      <label className="block text-2xs font-medium text-stone-500 leading-none">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}
