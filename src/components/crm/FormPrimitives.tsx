import { useState } from 'react';
import { ChevronDown, Loader2, Save, X } from 'lucide-react';
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
    <div id={id} className="rounded-[10px] border border-stone-200 bg-white scroll-mt-16">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-4 py-3 bg-stone-50/70 hover:bg-stone-100/60 transition-colors text-left',
          isOpen ? 'rounded-t-[10px] border-b border-stone-200' : 'rounded-[10px]',
        )}
      >
        <div className="flex items-center gap-2">
          {index !== undefined && (
            <div className="w-1 h-4 rounded-full shrink-0 bg-brand" />
          )}
          <h3 className="text-sm font-semibold text-stone-950">{title}</h3>
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

export function FormActionBar({
  onCancel,
  isPending,
  isUploadingFiles = false,
  submitLabel = 'Save Changes',
}: {
  onCancel: () => void;
  isPending: boolean;
  isUploadingFiles?: boolean;
  submitLabel?: string;
}) {
  const busy = isPending || isUploadingFiles;
  const saveLabel = isPending ? 'Saving…' : isUploadingFiles ? 'Uploading…' : submitLabel;
  return (
    <div className="fixed bottom-0 left-0 right-0 lg:left-56 z-20 border-t border-stone-200 bg-white px-6 py-3 flex items-center justify-end gap-3 shadow-sm">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 transition-all"
      >
        <X className="size-3" />
        Cancel
      </button>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm active:scale-95"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
        {saveLabel}
      </button>
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
