import { useState, useRef, useEffect } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  inputClassName?: string;
  hideKbd?: boolean;
  autoFocus?: boolean;
  onNavigate?: () => void;
}

export function GlobalSearch({ className, inputClassName, autoFocus }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses the search from anywhere
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Auto-focus for mobile expansion
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Input */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          disabled
          placeholder="Search coming soon"
          aria-label="Global search (coming soon)"
          className={cn(
            'h-10 w-full rounded-full border border-white/[0.13] bg-white/[0.07] pl-4 pr-11 text-sm text-stone-200 placeholder:text-stone-400 opacity-75 transition-all',
            inputClassName,
          )}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        />
        {/* Search icon button — right side */}
        <div className="pointer-events-none absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.10]">
          <Search className="size-3.5 text-stone-400" />
        </div>
      </div>

      {/* Coming Soon Dropdown */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl dark:border-stone-800 dark:bg-stone-950"
        >
          <div className="px-4 py-6 text-center">
            <div className="mb-3 flex justify-center">
              <div className="rounded-lg bg-brand/10 p-2.5">
                <Sparkles className="size-5 text-brand" />
              </div>
            </div>
            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Global Search Coming Soon
            </p>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Backend search functionality will be implemented in a future release.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
