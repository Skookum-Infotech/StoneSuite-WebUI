import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Check } from 'lucide-react';
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
  /** 'field' (default) fills its container, sized for a form row — this is the
   *  Edit page's control, unchanged. 'pill' renders a compact colored
   *  badge-button sized for a table cell or a Detail page sidebar row. */
  variant?: 'field' | 'pill';
  /** In 'transitions' mode, defer the /transitions fetch until the dropdown is
   *  actually opened, instead of on mount — avoids firing one request per row
   *  when this control sits in a list table. The Edit page (one record on
   *  screen) omits this so its dropdown preloads instantly. */
  lazy?: boolean;
};

// CRM's parallel to StatusSelect (pages/sales/components/StatusSelect.tsx) —
// same trigger/listbox mechanics, but statuses come from the live per-record
// /transitions endpoint (workflows are tenant-configurable, so there's no
// static allowedTransitions map to mirror) rather than a fixed catalog.
//
// The 'pill' variant arms a two-step confirm for any option whose target
// state is terminal (server-reported via StatusInfo.isTerminal): one click
// shows "Confirm: <label>", a second click on the same option commits it.
// This only applies in 'pill' mode; the Edit page's 'field' variant keeps
// firing on a single click, as it always has.
export function StatusDropdown({
  workflowKey, mode, recordId, value, onChange, disabled, variant = 'field', lazy = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [armedStateId, setArmedStateId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPill = variant === 'pill';

  const allQuery = useQuery({
    queryKey: ['crm-statuses-workflow', workflowKey],
    queryFn: () => crmService.getWorkflowStatuses(workflowKey),
    enabled: mode === 'all',
    staleTime: 10 * 60 * 1000,
  });

  const transitionsQuery = useQuery({
    queryKey: ['crm-transitions', recordId],
    queryFn: () => crmService.getAvailableTransitions(recordId!, workflowKey),
    enabled: mode === 'transitions' && Boolean(recordId) && (!lazy || open),
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

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setArmedStateId(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setArmedStateId(null); }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const selected = statuses.find((s) => s.stateId === value);
  const isDisabled = disabled || isLoading;
  const color = selected?.color ?? '#a8a29e';

  const triggerCls = isPill
    ? 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-stone-600 whitespace-nowrap transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70'
    : `${fieldCls} flex items-center gap-2`;

  return (
    <div ref={containerRef} className={isPill ? 'relative inline-block' : 'relative w-full'}>
      <button
        type="button"
        aria-label="Select status"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => { if (!isDisabled) { setOpen((v) => !v); setArmedStateId(null); } }}
        disabled={isDisabled}
        className={triggerCls}
        style={isPill ? { backgroundColor: `${color}18` } : undefined}
      >
        {isPill && selected && (
          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
        )}
        {selected ? (
          <span className={isPill ? undefined : 'flex-1 text-left'}>{selected.statusLabel}</span>
        ) : (
          <span className={isPill ? undefined : 'flex-1 text-left text-stone-900'}>
            {isLoading ? 'Loading…' : 'Select status…'}
          </span>
        )}
        <ChevronDown className={isPill ? 'size-3 shrink-0' : 'size-3 shrink-0 text-stone-400'} aria-hidden="true" />
      </button>

      {open && !isDisabled && (
        <div
          role="listbox"
          className={`absolute z-20 mt-1 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-md ${isPill ? 'left-0 w-56' : 'w-full'}`}
        >
          {statuses.map((s) => {
            const isCurrent = s.stateId === value;
            const terminalTarget = isPill && !isCurrent && s.isTerminal;
            const armed = armedStateId === s.stateId;
            return (
              <button
                key={s.stateId}
                type="button"
                role="option"
                aria-selected={isCurrent}
                onClick={() => {
                  if (terminalTarget && !armed) { setArmedStateId(s.stateId); return; }
                  onChange(s.stateId, s.statusLabel);
                  setOpen(false);
                  setArmedStateId(null);
                }}
                className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-sm transition ${
                  isCurrent
                    ? 'bg-brand/10 font-semibold text-stone-900'
                    : armed
                      ? 'bg-red-50 font-semibold text-red-700'
                      : 'text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span className="flex-1 text-left">{armed ? `Confirm: ${s.statusLabel}` : s.statusLabel}</span>
                {armed && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
          {statuses.length === 0 && (
            <p className="px-3.5 py-2.5 text-sm text-stone-400">No statuses available.</p>
          )}
        </div>
      )}
    </div>
  );
}
