import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Filter } from 'lucide-react';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import { lookupService } from '@/services/lookupService';
import { workflowService } from '@/services/tenantServices';
import { activeCustomFields } from '@/lib/customFields';
import { useModalDialog } from '@/hooks/useModalDialog';
import { EMPTY_FILTER_STATE, type JournalEntryFilterState } from '@/lib/journalEntryFilters';

// Filter drawer for the Journal Entry list — mirrors ItemReceiptFilterDrawer
// (same "mount only while open" pattern so `draft` re-initializes from
// `value` with no sync effect needed).
export function JournalEntryFilterDrawer({ onClose, value, onApply }: {
  onClose: () => void;
  value: JournalEntryFilterState;
  onApply: (next: JournalEntryFilterState) => void;
}) {
  const [draft, setDraft] = useState<JournalEntryFilterState>(value);
  const contentRef = useModalDialog(onClose);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const jeWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'cash_transfer');
  const { data: jeDef } = useQuery({
    queryKey: ['workflow', jeWorkflow?.id],
    queryFn: () => workflowService.get(jeWorkflow?.id ?? ''),
    enabled: Boolean(jeWorkflow?.id),
  });
  const customFieldDefs = activeCustomFields(jeDef);

  const set = <K extends keyof JournalEntryFilterState>(key: K, val: JournalEntryFilterState[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex justify-end bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="je-filter-drawer-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="flex h-full w-full max-w-sm flex-col bg-white shadow-2xl outline-none">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-stone-500" aria-hidden="true" />
            <h2 id="je-filter-drawer-title" className="text-sm font-bold text-stone-900">Filters</h2>
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
          <FilterField label="Journal Entry #">
            <input type="text" value={draft.recordNumber} onChange={(e) => set('recordNumber', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="Journal Entry #" />
          </FilterField>
          <FilterField label="Reference">
            <input type="text" value={draft.reference} onChange={(e) => set('reference', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="Reference" />
          </FilterField>

          <FilterField label="Date">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={draft.transferDateFrom} onChange={(e) => set('transferDateFrom', e.target.value)} className={fieldCls} aria-label="Date from" />
              <input type="date" value={draft.transferDateTo} onChange={(e) => set('transferDateTo', e.target.value)} className={fieldCls} aria-label="Date to" />
            </div>
          </FilterField>
          <FilterField label="Amount">
            <div className="grid grid-cols-2 gap-2">
              <input type="number" step="0.01" min="0" value={draft.amountMin} onChange={(e) => set('amountMin', e.target.value)} placeholder="Min" className={fieldCls} aria-label="Amount min" />
              <input type="number" step="0.01" min="0" value={draft.amountMax} onChange={(e) => set('amountMax', e.target.value)} placeholder="Max" className={fieldCls} aria-label="Amount max" />
            </div>
          </FilterField>
          <FilterField label="Created">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={draft.createdAtFrom} onChange={(e) => set('createdAtFrom', e.target.value)} className={fieldCls} aria-label="Created from" />
              <input type="date" value={draft.createdAtTo} onChange={(e) => set('createdAtTo', e.target.value)} className={fieldCls} aria-label="Created to" />
            </div>
          </FilterField>
          <FilterField label="Updated">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={draft.updatedAtFrom} onChange={(e) => set('updatedAtFrom', e.target.value)} className={fieldCls} aria-label="Updated from" />
              <input type="date" value={draft.updatedAtTo} onChange={(e) => set('updatedAtTo', e.target.value)} className={fieldCls} aria-label="Updated to" />
            </div>
          </FilterField>

          <FilterField label="Owner">
            <select value={draft.ownerId} onChange={(e) => set('ownerId', e.target.value)} className={fieldCls} aria-label="Owner">
              <option value="">— Any —</option>
              {(lookups?.employees ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
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
