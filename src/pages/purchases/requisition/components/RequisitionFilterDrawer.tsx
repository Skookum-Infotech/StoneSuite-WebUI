import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Filter } from 'lucide-react';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import { lookupService } from '@/services/lookupService';
import { workflowService } from '@/services/tenantServices';
import { activeCustomFields } from '@/lib/customFields';
import { useModalDialog } from '@/hooks/useModalDialog';
import { REQUISITION_PRIORITIES } from '@/lib/requisitionForm';
import { EMPTY_FILTER_STATE, type RequisitionFilterState } from '@/lib/requisitionFilters';

// Filter drawer for the Requisition list — covers the server-whitelisted
// filter keys (requisition/resolver.go systemFields) minus `status` and
// `vendor_id`.
//
// Both of those compare against internal INTEGER ids: `status` against
// lkp_record_status.record_status_id and `vendor_id` against the tenant's
// vendor row id. No endpoint exposes either (there is no
// GET /tenant/lookups/record-statuses, and VendorPicker/vendorService only
// ever yield UUIDs), so neither filter can be built correctly today — the same
// constraint PurchaseOrderFilterDrawer documents. Vendor filtering works via
// `vendor_name` (a plain ILIKE match) instead; status is best reached by
// sorting the list on Status.
//
// The caller only mounts this component while open (`{filtersOpen && <.../>}`)
// rather than passing an `open` prop — that way `draft` always initializes
// fresh from `value` on mount, with no effect needed to re-sync it.
export function RequisitionFilterDrawer({ onClose, value, onApply }: {
  onClose: () => void;
  value: RequisitionFilterState;
  onApply: (next: RequisitionFilterState) => void;
}) {
  const [draft, setDraft] = useState<RequisitionFilterState>(value);
  const contentRef = useModalDialog(onClose);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const reqnWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'requisition');
  const { data: reqnDef } = useQuery({
    queryKey: ['workflow', reqnWorkflow?.id],
    queryFn: () => workflowService.get(reqnWorkflow?.id ?? ''),
    enabled: Boolean(reqnWorkflow?.id),
  });
  const customFieldDefs = activeCustomFields(reqnDef);

  const set = <K extends keyof RequisitionFilterState>(key: K, val: RequisitionFilterState[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex justify-end bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reqn-filter-drawer-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="flex h-full w-full max-w-sm flex-col bg-white shadow-2xl outline-none">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-stone-500" aria-hidden="true" />
            <h2 id="reqn-filter-drawer-title" className="text-sm font-bold text-stone-900">Filters</h2>
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
          <FilterField label="Requisition #">
            <input type="text" value={draft.recordNumber} onChange={(e) => set('recordNumber', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="Requisition #" />
          </FilterField>
          <FilterField label="Suggested Vendor">
            <input type="text" value={draft.vendorName} onChange={(e) => set('vendorName', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="Suggested vendor name" />
          </FilterField>
          <FilterField label="Department">
            <input type="text" value={draft.department} onChange={(e) => set('department', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="Department" />
          </FilterField>

          <FilterField label="Priority">
            <select value={draft.priority} onChange={(e) => set('priority', e.target.value)} className={fieldCls} aria-label="Priority">
              <option value="">— Any —</option>
              {REQUISITION_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Requested By">
            <select value={draft.requestedById} onChange={(e) => set('requestedById', e.target.value)} className={fieldCls} aria-label="Requested by">
              <option value="">— Any —</option>
              {(lookups?.employees ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Needed By">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={draft.neededByFrom} onChange={(e) => set('neededByFrom', e.target.value)} className={fieldCls} aria-label="Needed by from" />
              <input type="date" value={draft.neededByTo} onChange={(e) => set('neededByTo', e.target.value)} className={fieldCls} aria-label="Needed by to" />
            </div>
          </FilterField>

          <FilterField label="Estimated Total">
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" step="0.01" value={draft.estimatedTotalMin} onChange={(e) => set('estimatedTotalMin', e.target.value)} placeholder="Min" className={fieldCls} aria-label="Estimated total minimum" />
              <input type="number" min="0" step="0.01" value={draft.estimatedTotalMax} onChange={(e) => set('estimatedTotalMax', e.target.value)} placeholder="Max" className={fieldCls} aria-label="Estimated total maximum" />
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
