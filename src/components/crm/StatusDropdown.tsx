import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { crmService } from '@/services/crmService';
import type { StatusInfo } from '@/types/tenant';

type Props = {
  workflowKey: string;
  mode: 'all' | 'transitions';
  recordId?: string;
  value: string;
  onChange: (stateId: string, label: string) => void;
  disabled?: boolean;
};

export function StatusDropdown({ workflowKey, mode, recordId, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const allQuery = useQuery({
    queryKey: ['crm-statuses-workflow', workflowKey],
    queryFn: () => crmService.getWorkflowStatuses(workflowKey),
    enabled: mode === 'all',
  });

  const transitionsQuery = useQuery({
    queryKey: ['crm-transitions', recordId],
    queryFn: () => crmService.getAvailableTransitions(recordId!),
    enabled: mode === 'transitions' && Boolean(recordId),
  });

  const statuses: StatusInfo[] = useMemo(
    () =>
      mode === 'all'
        ? (allQuery.data?.statuses ?? [])
        : (transitionsQuery.data ?? []),
    [mode, allQuery.data, transitionsQuery.data],
  );

  const isLoading = mode === 'all' ? allQuery.isLoading : transitionsQuery.isLoading;

  // Auto-select initial state when statuses first load and no value is set
  useEffect(() => {
    if (mode === 'all' && !value && statuses.length > 0) {
      const initial = statuses.find((s) => s.isInitial) ?? statuses[0];
      onChange(initial.stateId, initial.statusLabel);
    }
  // onChange intentionally omitted — it's a callback, callers must memoize it if needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, value, statuses]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selected = statuses.find((s) => s.stateId === value);
  const isDisabled = disabled || isLoading;

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        aria-label="Select status"
        aria-expanded={open}
        onClick={() => !isDisabled && setOpen((v) => !v)}
        disabled={isDisabled}
        className="flex w-full items-center gap-2 rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
      >
        {selected ? (
          <>
            <span
              className="size-2 flex-shrink-0 rounded-full"
              style={{ backgroundColor: selected.color || '#a8a29e' }}
            />
            <span className="flex-1 text-left">{selected.statusLabel}</span>
          </>
        ) : (
          <span className="flex-1 text-left text-stone-400">
            {isLoading ? 'Loading…' : 'Select status…'}
          </span>
        )}
        <ChevronDown className="size-3 flex-shrink-0 text-stone-400" />
      </button>

      {open && !isDisabled && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded border border-stone-200 bg-white shadow-lg">
          {statuses.map((s) => (
            <button
              key={s.stateId}
              type="button"
              onClick={() => {
                onChange(s.stateId, s.statusLabel);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-xs transition hover:bg-stone-50 ${
                s.stateId === value ? 'bg-brand/10 font-semibold text-stone-900' : 'text-stone-700'
              }`}
            >
              <span
                className="size-2 flex-shrink-0 rounded-full"
                style={{ backgroundColor: s.color || '#a8a29e' }}
              />
              {s.statusLabel}
            </button>
          ))}
          {statuses.length === 0 && (
            <p className="px-2 py-2 text-xs text-stone-400">No statuses available.</p>
          )}
        </div>
      )}
    </div>
  );
}
