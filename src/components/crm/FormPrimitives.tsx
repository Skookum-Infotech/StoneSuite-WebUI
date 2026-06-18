import { cn } from '@/lib/utils';
import { fieldLabelCls } from './formUtils';

const SECTION_ACCENTS: Record<string, string> = {
  'Primary Information': 'bg-purple-400',
  'Contact Information': 'bg-blue-400',
  'Billing Address': 'bg-sky-400',
  'Shipping Address': 'bg-cyan-400',
  'CRM Fields': 'bg-violet-400',
  'Sales Fields': 'bg-amber-400',
  'Credit Fields': 'bg-orange-400',
  'Customer Balances': 'bg-emerald-400',
  'Custom Fields': 'bg-teal-400',
};

export function ModernSection({ title, children }: { title: string; index?: number; children: React.ReactNode }) {
  const accent = SECTION_ACCENTS[title] ?? 'bg-stone-400';
  const id = `form-section-${title.toLowerCase().replace(/[\s/]+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
  return (
    <div id={id} className="rounded-md border border-stone-200 bg-white overflow-hidden scroll-mt-16">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-stone-50/70">
        <div className={cn('w-1 h-4 rounded-full shrink-0', accent)} />
        <h3 className="text-2xs font-bold uppercase tracking-widest text-black">
          {title}
        </h3>
      </div>
      <div className="px-5 py-6">{children}</div>
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
      {label && (
        <label className={fieldLabelCls}>
          {label}
          {required && <span className="ml-0.5 text-red-400">*</span>}
        </label>
      )}
      {children}
    </div>
  );
}
