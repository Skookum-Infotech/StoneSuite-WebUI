import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { fieldCls } from '@/components/crm/formUtils';
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
    staleTime: 10 * 60 * 1000,
  });

  const transitionsQuery = useQuery({
    queryKey: ['crm-transitions', recordId],
    queryFn: () => crmService.getAvailableTransitions(recordId!, workflowKey),
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

  // Auto-select initial state when statuses first load and no value is set.
  // Callers must wrap onChange in useCallback to prevent unnecessary effect runs.
  useEffect(() => {
    if (mode === 'all' && !value && statuses.length > 0) {
      const initial = statuses.find((s) => s.isInitial) ?? statuses[0];
      onChange(initial.stateId, initial.statusLabel);
    }
  }, [mode, value, statuses, onChange]);

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
        className={`${fieldCls} flex items-center gap-2`}
      >
        {selected ? (
          <>
            <span className="flex-1 text-left">{selected.statusLabel}</span>
          </>
        ) : (
          <span className="flex-1 text-left text-stone-900">
            {isLoading ? 'Loading…' : 'Select status…'}
          </span>
        )}
        <ChevronDown className="size-3 shrink-0 text-stone-400" />
      </button>

      {open && !isDisabled && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-md">
          {statuses.map((s) => (
            <button
              key={s.stateId}
              type="button"
              onClick={() => {
                onChange(s.stateId, s.statusLabel);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-sm transition ${
                s.stateId === value ? 'bg-brand/10 font-semibold text-stone-900' : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              {s.statusLabel}
            </button>
          ))}
          {statuses.length === 0 && (
            <p className="px-3.5 py-2.5 text-sm text-stone-400">No statuses available.</p>
          )}
        </div>
      )}
    </div>
  );
}
