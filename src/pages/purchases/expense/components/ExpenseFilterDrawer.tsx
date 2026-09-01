import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Filter } from 'lucide-react';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import { lookupService } from '@/services/lookupService';
import { workflowService } from '@/services/tenantServices';
import { useModalDialog } from '@/hooks/useModalDialog';
import { EMPTY_FILTER_STATE, type ExpenseFilterState } from '@/lib/expenseFilters';

// Filter drawer for the Expense list — covers the server-whitelisted filter
// keys (expense/resolver.go systemFields) minus `status`, which compares
// against an internal INTEGER id with no exposed lookup endpoint (same
// constraint RequisitionFilterDrawer documents for its own status filter) —
// best reached by sorting the list on Status instead.
//
// The caller only mounts this component while open (`{filtersOpen && <.../>}`)
// rather than passing an `open` prop — that way `draft` always initializes
// fresh from `value` on mount, with no effect needed to re-sync it.
export function ExpenseFilterDrawer({ onClose, value, onApply }: {
  onClose: () => void;
  value: ExpenseFilterState;
  onApply: (next: ExpenseFilterState) => void;
}) {
  const [draft, setDraft] = useState<ExpenseFilterState>(value);
  const contentRef = useModalDialog(onClose);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const expWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'expense');
  const { data: expDef } = useQuery({
    queryKey: ['workflow', expWorkflow?.id],
    queryFn: () => workflowService.get(expWorkflow?.id ?? ''),
    enabled: Boolean(expWorkflow?.id),
  });
  const customFieldDefs = expDef?.fields ?? [];

  const set = <K extends keyof ExpenseFilterState>(key: K, val: ExpenseFilterState[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex justify-end bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exp-filter-drawer-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="flex h-full w-full max-w-sm flex-col bg-white shadow-2xl outline-none">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-stone-500" aria-hidden="true" />
            <h2 id="exp-filter-drawer-title" className="text-sm font-bold text-stone-900">Filters</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto modal-scrollbar px-4 py-4 space-y-5">
          <FilterField label="Expense #">
            <input type="text" value={draft.recordNumber} onChange={(e) => set('recordNumber', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="Expense #" />
          </FilterField>
          <FilterField label="Department">
            <input type="text" value={draft.department} onChange={(e) => set('department', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="Department" />
          </FilterField>

          <FilterField label="Claimant">
            <select value={draft.claimantId} onChange={(e) => set('claimantId', e.target.value)} className={fieldCls} aria-label="Claimant">
              <option value="">— Any —</option>
              {(lookups?.employees ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Total">
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" step="0.01" value={draft.totalMin} onChange={(e) => set('totalMin', e.target.value)} placeholder="Min" className={fieldCls} aria-label="Total minimum" />
              <input type="number" min="0" step="0.01" value={draft.totalMax} onChange={(e) => set('totalMax', e.target.value)} placeholder="Max" className={fieldCls} aria-label="Total maximum" />
            </div>
          </FilterField>

          {customFieldDefs.length > 0 && (
            <div className="space-y-4 border-t border-stone-100 pt-4">
              <p className={fieldLabelCls}>Custom Fields</p>
              {customFieldDefs.map((def) => (
                <FilterField key={def.id} label={def.label}>
                  <input
                    type="text"
                    value={draft.customFields[def.key] ?? ''}
                    onChange={(e) => set('customFields', { ...draft.customFields, [def.key]: e.target.value })}
                    placeholder="Contains…"
                    className={fieldCls}
                    aria-label={def.label}
                  />
                </FilterField>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-stone-200 px-4 py-3 shrink-0">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_FILTER_STATE)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={() => { onApply(draft); onClose(); }}
            className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover transition-colors shadow-sm"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className={fieldLabelCls}>{label}</label>
      {children}
    </div>
  );
}
