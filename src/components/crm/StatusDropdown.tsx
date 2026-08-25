import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Check } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { fieldCls, resolveStatusColor } from '@/components/crm/formUtils';
import { useFloatingDropdownPosition } from '@/hooks/useFloatingDropdownPosition';
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

const PANEL_WIDTH = 224; // w-56

// CRM's parallel to StatusSelect (pages/sales/components/StatusSelect.tsx) —
// same trigger/listbox mechanics, but statuses come from the live per-record
// /transitions endpoint (workflows are tenant-configurable, so there's no
// static allowedTransitions map to mirror) rather than a fixed catalog.
//
// The 'pill' variant arms a two-step confirm for any option whose target
// state is terminal (server-reported via StatusInfo.isTerminal): one click
// shows "Confirm: <label>", a second click on the same option commits it.
// This only applies in 'pill' mode; the Edit page's 'field' variant keeps
// firing on a single click, as it always has. 'pill' also portals its panel
// to document.body with fixed positioning, since a pill lives in a table
// cell whose overflow-x-auto scroll wrapper would otherwise clip it.
export function StatusDropdown({
  workflowKey, mode, recordId, value, onChange, disabled, variant = 'field', lazy = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [armedStateId, setArmedStateId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isPill = variant === 'pill';

  const close = useCallback(() => {
    setOpen(false);
    setArmedStateId(null);
  }, []);

  // Escape/select return focus to the trigger (it's still on screen and still
  // the natural place for focus to land); outside-click/scroll just close, so
  // we don't fight whatever the user clicked or steal focus while scrolling.
  const closeAndReturnFocus = useCallback(() => {
    close();
    triggerRef.current?.focus();
  }, [close]);

  const floatingPosition = useFloatingDropdownPosition(isPill && open, containerRef, close, PANEL_WIDTH);

  // The workflow's full status catalog (id/label/color per status) — always
  // fetched, not just in mode="all". This is what resolves the *closed*
  // trigger's own label + color for mode="transitions", independent of
  // `lazy`: the /transitions fetch below is deferred until the dropdown
  // opens, so it has no data yet to describe the current status while
  // closed. The table already fetches this same query key once for its
  // status filter, so this is a cache hit, not an extra request.
  const catalogQuery = useQuery({
    queryKey: ['crm-statuses-workflow', workflowKey],
    queryFn: () => crmService.getWorkflowStatuses(workflowKey),
    staleTime: 10 * 60 * 1000,
  });
  const catalogStatuses = useMemo(() => catalogQuery.data?.statuses ?? [], [catalogQuery.data]);

  // With `lazy`, this only starts fetching once `open` flips true — so
  // isLoading only ever becomes true *after* the panel is already open.
  // Nothing here may key off isLoading to hide the panel or disable the
  // trigger, or the panel would open and immediately vanish out from under
  // the click that opened it.
  const transitionsQuery = useQuery({
    queryKey: ['crm-transitions', recordId],
    queryFn: () => crmService.getAvailableTransitions(recordId!, workflowKey),
    enabled: mode === 'transitions' && Boolean(recordId) && (!lazy || open),
  });

  // Options shown when the panel is open: the full catalog in "all" mode,
  // this record's legal next moves in "transitions" mode.
  const statuses: StatusInfo[] = useMemo(
    () => (mode === 'all' ? catalogStatuses : (transitionsQuery.data ?? [])),
    [mode, catalogStatuses, transitionsQuery.data],
  );

  // Two distinct loading concerns: the trigger's own placeholder depends on
  // the catalog (it resolves `selected` regardless of mode); the panel's
  // empty-state message depends on whichever source is feeding its options.
  const catalogLoading = catalogQuery.isLoading;
  const optionsLoading = mode === 'all' ? catalogQuery.isLoading : transitionsQuery.isLoading;

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
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        !(panelRef.current && panelRef.current.contains(target))
      ) {
        close();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeAndReturnFocus();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, close, closeAndReturnFocus]);

  // Resolved from the catalog, not `statuses` — the trigger must be able to
  // show the current status (label + color) even while closed and even
  // before a lazy /transitions fetch has ever run.
  const selected = catalogStatuses.find((s) => s.stateId === value);
  // Same fallback chain as the static badges this replaces (CrmRecordTable,
  // LeadDetailPage, etc.): backend color, then a local per-tenant-agnostic
  // default keyed by stateKey, then a neutral gray.
  const color = selected ? resolveStatusColor(selected.stateKey, selected.color) : '#a8a29e';

  const triggerCls = isPill
    ? 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-stone-600 whitespace-nowrap transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70'
    : `${fieldCls} flex items-center gap-2`;

  const optionRows = statuses.length > 0 ? statuses.map((s) => {
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
          closeAndReturnFocus();
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
  }) : (
    <p className="px-3.5 py-2.5 text-sm text-stone-400">{optionsLoading ? 'Loading…' : 'No statuses available.'}</p>
  );

  const panelOpen = open && !disabled;

  return (
    <div ref={containerRef} className={isPill ? 'relative inline-block' : 'relative w-full'}>
      {/* No aria-label: the visible label (e.g. "Draft") IS the accessible
          name. An aria-label would override it and cost screen-reader users
          the one thing this control reports — the current status. */}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => { if (!disabled) { if (open) close(); else setOpen(true); } }}
        disabled={disabled}
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
            {catalogLoading ? 'Loading…' : 'Select status…'}
          </span>
        )}
        <ChevronDown className={isPill ? 'size-3 shrink-0' : 'size-3 shrink-0 text-stone-400'} aria-hidden="true" />
      </button>

      {panelOpen && !isPill && (
        <div role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-md">
          {optionRows}
        </div>
      )}

      {panelOpen && isPill && floatingPosition && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          className="fixed z-50 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg"
          style={{ left: floatingPosition.left, top: floatingPosition.top, bottom: floatingPosition.bottom, width: PANEL_WIDTH }}
        >
          {optionRows}
        </div>,
        document.body,
      )}
    </div>
  );
}
