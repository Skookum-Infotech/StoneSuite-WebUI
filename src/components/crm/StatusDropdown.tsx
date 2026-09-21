import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Check } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { fieldCls, resolveStatusColor } from '@/components/crm/formUtils';
import { useFloatingDropdownPosition } from '@/hooks/useFloatingDropdownPosition';
import { isCrmTransitionBlocked } from '@/lib/crmApproval';
import type { StatusInfo } from '@/types/tenant';

type Props = {
  workflowKey: string;
  /** The record whose legal next moves are listed. */
  recordId: string;
  value: string;
  onChange: (stateId: string, label: string) => void;
  disabled?: boolean;
  /** 'field' (default) fills its container, sized for a form row — this is the
   *  Edit page's control, unchanged. 'pill' renders a compact colored
   *  badge-button sized for a table cell or a Detail page sidebar row. */
  variant?: 'field' | 'pill';
  /** Defer the /transitions fetch until the dropdown is actually opened, instead
   *  of on mount — avoids firing one request per row when this control sits in
   *  a list table. The Edit page (one record on screen) omits this so its
   *  dropdown preloads instantly. */
  lazy?: boolean;
  /** True while the record's stage is awaiting or rejected from approval
   *  (record.approval.gated) — every option except the stage's own lost/
   *  unqualified exit renders disabled with a tooltip instead of firing and
   *  409ing server-side. Omit (or false) for a workflow with no approval gate. */
  gated?: boolean;
};

const PANEL_WIDTH = 224; // w-56
const CATALOG_STALE_MS = 10 * 60 * 1000;
const NO_MOVES_MESSAGE = 'No further status changes.';

// CRM's parallel to StatusSelect (pages/sales/components/StatusSelect.tsx) —
// same trigger/listbox mechanics, but the options come from the live per-record
// /transitions endpoint rather than a fixed catalog: they depend on the
// record's stage AND current status (a New lead is offered only Qualified and
// Unqualified; those two are final). A record with nothing left to move to
// renders as a plain status — no chevron, nothing to open — like StatusSelect's
// terminal state.
//
// The 'pill' variant arms a two-step confirm for any option whose target
// state is terminal (server-reported via StatusInfo.isTerminal): one click
// shows "Confirm: <label>", a second click on the same option commits it.
// This only applies in 'pill' mode; the Edit page's 'field' variant keeps
// firing on a single click, as it always has. 'pill' also portals its panel
// to document.body with fixed positioning, since a pill lives in a table
// cell whose overflow-x-auto scroll wrapper would otherwise clip it.
export function StatusDropdown({
  workflowKey, recordId, value, onChange, disabled, variant = 'field', lazy = false, gated = false,
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

  // The workflow's full status catalog (id/label/color per status). This is
  // what resolves the *closed* trigger's own label + color, independent of
  // `lazy`: the /transitions fetch below is deferred until the dropdown opens,
  // and only lists where the record can go — it never describes the status
  // it is already in. The table already fetches this same query key once for
  // its status filter, so this is a cache hit, not an extra request.
  const catalogQuery = useQuery({
    queryKey: ['crm-statuses-workflow', workflowKey],
    queryFn: () => crmService.getWorkflowStatuses(workflowKey),
    staleTime: CATALOG_STALE_MS,
  });
  const catalogStatuses = useMemo(() => catalogQuery.data?.statuses ?? [], [catalogQuery.data]);

  // Keyed on the current status as well as the record: the legal moves change
  // every time the status does, so a new `value` is a new key and a list built
  // for the old status is never reused. The pages' transition mutations also
  // invalidate ['crm-transitions', id] on success — the Edit pages apply the new
  // status optimistically, so the fetch under the new key can race the commit.
  //
  // With `lazy`, this only starts fetching once `open` flips true — so
  // isLoading only ever becomes true *after* the panel is already open.
  // Nothing here may key off isLoading to hide the panel or disable the
  // trigger, or the panel would open and immediately vanish out from under
  // the click that opened it.
  const transitionsQuery = useQuery({
    queryKey: ['crm-transitions', recordId, value],
    queryFn: () => crmService.getAvailableTransitions(recordId, workflowKey),
    enabled: Boolean(recordId) && (!lazy || open),
  });

  // Options shown when the panel is open: this record's legal next moves.
  const statuses: StatusInfo[] = useMemo(() => transitionsQuery.data ?? [], [transitionsQuery.data]);

  // Two distinct loading concerns: the trigger's own placeholder depends on
  // the catalog (it resolves `selected`); the panel's empty-state message
  // depends on the transitions fetch.
  const catalogLoading = catalogQuery.isLoading;
  const optionsLoading = transitionsQuery.isLoading;

  // No moves left (a Qualified/Unqualified lead): show a static status. Not
  // applied to a `lazy` pill — its options aren't fetched until opened, so it
  // can't know yet; its panel says so instead (NO_MOVES_MESSAGE).
  const isFinal = !lazy && transitionsQuery.isSuccess && statuses.length === 0;

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
    const blocked = !isCurrent && isCrmTransitionBlocked(gated, s.stateKey);
    return (
      <button
        key={s.stateId}
        type="button"
        role="option"
        aria-selected={isCurrent}
        aria-disabled={blocked}
        title={blocked ? 'Awaiting approval sign-off' : undefined}
        onClick={() => {
          if (blocked) return;
          if (terminalTarget && !armed) { setArmedStateId(s.stateId); return; }
          onChange(s.stateId, s.statusLabel);
          closeAndReturnFocus();
        }}
        className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-sm transition ${
          blocked
            ? 'cursor-not-allowed text-stone-300'
            : isCurrent
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
    <p className="px-3.5 py-2.5 text-sm text-stone-400">{optionsLoading ? 'Loading…' : NO_MOVES_MESSAGE}</p>
  );

  const panelOpen = open && !disabled && !isFinal;

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
        title={isFinal ? NO_MOVES_MESSAGE : undefined}
        onClick={() => { if (!disabled && !isFinal) { if (open) close(); else setOpen(true); } }}
        disabled={disabled || isFinal}
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
        {!isFinal && (
          <ChevronDown className={isPill ? 'size-3 shrink-0' : 'size-3 shrink-0 text-stone-400'} aria-hidden="true" />
        )}
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
