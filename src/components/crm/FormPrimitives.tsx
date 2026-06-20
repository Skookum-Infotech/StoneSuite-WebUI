import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldLabelCls } from './formUtils';


export function ModernSection({
  title,
  index,
  children,
  defaultCollapsed = false,
}: {
  title: string;
  index?: number;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);
  const id = `form-section-${title.toLowerCase().replace(/[\s/]+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
  return (
    <div id={id} className="rounded-[10px] border border-stone-200 bg-white overflow-hidden scroll-mt-16">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-4 py-3 bg-stone-50/70 hover:bg-stone-100/60 transition-colors text-left',
          isOpen && 'border-b border-stone-200',
        )}
      >
        <div className="flex items-center">
          {index !== undefined && (
            <span className="text-xs font-bold text-stone-400 w-5 shrink-0 tabular-nums">{index}.</span>
          )}
          <h3 className="text-xs font-bold text-stone-950">{title}</h3>
        </div>
        <ChevronDown
          className={cn(
            'size-4 text-stone-400 transition-transform duration-200 shrink-0',
            !isOpen && '-rotate-90',
          )}
        />
      </button>
      {isOpen && <div className="px-5 py-6">{children}</div>}
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
    <div className="space-y-1.5">
      {label && (
        <label className={fieldLabelCls}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      {children}
    </div>
  );
}
