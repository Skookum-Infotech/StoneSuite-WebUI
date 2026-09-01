import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Filter } from 'lucide-react';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import { lookupService } from '@/services/lookupService';
import { workflowService } from '@/services/tenantServices';
import { activeCustomFields } from '@/lib/customFields';
import { useModalDialog } from '@/hooks/useModalDialog';
import { EMPTY_FILTER_STATE, type VendorBillFilterState } from '@/lib/vendorBillFilters';

// Filter drawer for the Vendor Bill list — covers the server-whitelisted
// filter keys (vendorbill/resolver.go systemFields) minus `status`,
// `vendor_id`, `purchase_order_id`, `currency_id`, and `payment_terms_id`:
// all compare against internal integer ids and no endpoint exposes any of
// those lookups today (mirrors PurchaseOrderFilterDrawer's reasoning —
// VendorPicker/vendorService only ever yields UUIDs). Unlike Purchase
// Order's drawer, there's no `vendorName` field either — the vendor_bill
// resolver only matches vendor name in the global search predicate, not as a
// filterable systemField.
//
// The caller only mounts this component while open (`{filtersOpen && <.../>}`)
// rather than passing an `open` prop — that way `draft` always initializes
// fresh from `value` on mount, with no effect needed to re-sync it.
export function VendorBillFilterDrawer({ onClose, value, onApply }: {
  onClose: () => void;
  value: VendorBillFilterState;
  onApply: (next: VendorBillFilterState) => void;
}) {
  const [draft, setDraft] = useState<VendorBillFilterState>(value);
  const contentRef = useModalDialog(onClose);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const vbWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'vendor_bill');
  const { data: vbDef } = useQuery({
    queryKey: ['workflow', vbWorkflow?.id],
    queryFn: () => workflowService.get(vbWorkflow?.id ?? ''),
    enabled: Boolean(vbWorkflow?.id),
  });
  const customFieldDefs = activeCustomFields(vbDef);

  const set = <K extends keyof VendorBillFilterState>(key: K, val: VendorBillFilterState[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex justify-end bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vb-filter-drawer-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="flex h-full w-full max-w-sm flex-col bg-white shadow-2xl outline-none">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-stone-500" aria-hidden="true" />
            <h2 id="vb-filter-drawer-title" className="text-sm font-bold text-stone-900">Filters</h2>
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
          <FilterField label="Bill #">
            <input type="text" value={draft.recordNumber} onChange={(e) => set('recordNumber', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="Bill #" />
          </FilterField>
          <FilterField label="Vendor's Invoice #">
            <input type="text" value={draft.vendorInvoiceNumber} onChange={(e) => set('vendorInvoiceNumber', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="Vendor's Invoice #" />
          </FilterField>

          <FilterField label="Bill Date">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={draft.billDateFrom} onChange={(e) => set('billDateFrom', e.target.value)} className={fieldCls} aria-label="Bill date from" />
              <input type="date" value={draft.billDateTo} onChange={(e) => set('billDateTo', e.target.value)} className={fieldCls} aria-label="Bill date to" />
            </div>
          </FilterField>
          <FilterField label="Due Date">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={draft.dueDateFrom} onChange={(e) => set('dueDateFrom', e.target.value)} className={fieldCls} aria-label="Due date from" />
              <input type="date" value={draft.dueDateTo} onChange={(e) => set('dueDateTo', e.target.value)} className={fieldCls} aria-label="Due date to" />
            </div>
          </FilterField>

          <FilterField label="Grand Total">
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" step="0.01" value={draft.grandTotalMin} onChange={(e) => set('grandTotalMin', e.target.value)} placeholder="Min" className={fieldCls} aria-label="Grand total minimum" />
              <input type="number" min="0" step="0.01" value={draft.grandTotalMax} onChange={(e) => set('grandTotalMax', e.target.value)} placeholder="Max" className={fieldCls} aria-label="Grand total maximum" />
            </div>
          </FilterField>
          <FilterField label="Balance Due">
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" step="0.01" value={draft.balanceDueMin} onChange={(e) => set('balanceDueMin', e.target.value)} placeholder="Min" className={fieldCls} aria-label="Balance due minimum" />
              <input type="number" min="0" step="0.01" value={draft.balanceDueMax} onChange={(e) => set('balanceDueMax', e.target.value)} placeholder="Max" className={fieldCls} aria-label="Balance due maximum" />
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
