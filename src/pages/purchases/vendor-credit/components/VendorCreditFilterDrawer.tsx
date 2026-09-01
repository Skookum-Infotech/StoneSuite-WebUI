import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Filter } from 'lucide-react';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import { lookupService } from '@/services/lookupService';
import { workflowService } from '@/services/tenantServices';
import { activeCustomFields } from '@/lib/customFields';
import { useModalDialog } from '@/hooks/useModalDialog';
import { EMPTY_FILTER_STATE, type VendorCreditFilterState } from '@/lib/vendorCreditFilters';

// Filter drawer for the Vendor Credit list — covers the server-whitelisted
// filter keys (vendorcredit/resolver.go systemFields) minus `status` and
// `vendor_id`, which compare against internal integer ids with no lookup
// endpoint behind them (same reasoning as VendorPaymentFilterDrawer).
//
// The caller only mounts this component while open (`{filtersOpen && <.../>}`)
// rather than passing an `open` prop — that way `draft` always initializes
// fresh from `value` on mount, with no effect needed to re-sync it.
export function VendorCreditFilterDrawer({ onClose, value, onApply }: {
  onClose: () => void;
  value: VendorCreditFilterState;
  onApply: (next: VendorCreditFilterState) => void;
}) {
  const [draft, setDraft] = useState<VendorCreditFilterState>(value);
  const contentRef = useModalDialog(onClose);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const vcWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'vendor_credit');
  const { data: vcDef } = useQuery({
    queryKey: ['workflow', vcWorkflow?.id],
    queryFn: () => workflowService.get(vcWorkflow?.id ?? ''),
    enabled: Boolean(vcWorkflow?.id),
  });
  const customFieldDefs = activeCustomFields(vcDef);

  const set = <K extends keyof VendorCreditFilterState>(key: K, val: VendorCreditFilterState[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex justify-end bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vc-filter-drawer-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="flex h-full w-full max-w-sm flex-col bg-white shadow-2xl outline-none">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-stone-500" aria-hidden="true" />
            <h2 id="vc-filter-drawer-title" className="text-sm font-bold text-stone-900">Filters</h2>
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
          <FilterField label="Credit #">
            <input type="text" value={draft.recordNumber} onChange={(e) => set('recordNumber', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="Credit #" />
          </FilterField>
          <FilterField label="Reference #">
            <input type="text" value={draft.referenceNumber} onChange={(e) => set('referenceNumber', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="Reference number" />
          </FilterField>
          <FilterField label="Reason">
            <input type="text" value={draft.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="Reason" />
          </FilterField>

          <FilterField label="Credit Date">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={draft.creditDateFrom} onChange={(e) => set('creditDateFrom', e.target.value)} className={fieldCls} aria-label="Credit date from" />
              <input type="date" value={draft.creditDateTo} onChange={(e) => set('creditDateTo', e.target.value)} className={fieldCls} aria-label="Credit date to" />
            </div>
          </FilterField>

          <FilterField label="Amount">
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" step="0.01" value={draft.amountMin} onChange={(e) => set('amountMin', e.target.value)} placeholder="Min" className={fieldCls} aria-label="Amount minimum" />
              <input type="number" min="0" step="0.01" value={draft.amountMax} onChange={(e) => set('amountMax', e.target.value)} placeholder="Max" className={fieldCls} aria-label="Amount maximum" />
            </div>
          </FilterField>
          <FilterField label="Unapplied Amount">
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" step="0.01" value={draft.unappliedMin} onChange={(e) => set('unappliedMin', e.target.value)} placeholder="Min" className={fieldCls} aria-label="Unapplied amount minimum" />
              <input type="number" min="0" step="0.01" value={draft.unappliedMax} onChange={(e) => set('unappliedMax', e.target.value)} placeholder="Max" className={fieldCls} aria-label="Unapplied amount maximum" />
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
