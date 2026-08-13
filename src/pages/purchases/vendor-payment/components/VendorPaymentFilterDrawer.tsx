import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Filter } from 'lucide-react';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import { lookupService } from '@/services/lookupService';
import { workflowService } from '@/services/tenantServices';
import { useModalDialog } from '@/hooks/useModalDialog';
import { PAYMENT_METHODS } from '@/lib/paymentMethods';
import { EMPTY_FILTER_STATE, type VendorPaymentFilterState } from '@/lib/vendorPaymentFilters';

const APPROVAL_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'Not required' },
  { value: 'pending', label: 'Pending approval' },
  { value: 'approved', label: 'Approved' },
];

// Filter drawer for the Vendor Payment list — covers the server-whitelisted
// filter keys (vendorpayment/resolver.go systemFields) minus `status`,
// `vendor_id`, `created_by`/`updated_by` and `id`: those compare against
// internal integer/uuid ids with no lookup endpoint behind them (same
// reasoning as VendorBillFilterDrawer). `method_id` *is* offered, because
// lib/paymentMethods.ts already mirrors the lkp_payment_method seed client-
// side, and `approval_status` is a plain VARCHAR so it filters by value.
//
// The caller only mounts this component while open (`{filtersOpen && <.../>}`)
// rather than passing an `open` prop — that way `draft` always initializes
// fresh from `value` on mount, with no effect needed to re-sync it.
export function VendorPaymentFilterDrawer({ onClose, value, onApply }: {
  onClose: () => void;
  value: VendorPaymentFilterState;
  onApply: (next: VendorPaymentFilterState) => void;
}) {
  const [draft, setDraft] = useState<VendorPaymentFilterState>(value);
  const contentRef = useModalDialog(onClose);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const vpWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'vendor_payment');
  const { data: vpDef } = useQuery({
    queryKey: ['workflow', vpWorkflow?.id],
    queryFn: () => workflowService.get(vpWorkflow?.id ?? ''),
    enabled: Boolean(vpWorkflow?.id),
  });
  const customFieldDefs = vpDef?.fields ?? [];

  const set = <K extends keyof VendorPaymentFilterState>(key: K, val: VendorPaymentFilterState[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex justify-end bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vp-filter-drawer-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="flex h-full w-full max-w-sm flex-col bg-white shadow-2xl outline-none">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-stone-500" aria-hidden="true" />
            <h2 id="vp-filter-drawer-title" className="text-sm font-bold text-stone-900">Filters</h2>
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
          <FilterField label="Payment #">
            <input type="text" value={draft.recordNumber} onChange={(e) => set('recordNumber', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="Payment #" />
          </FilterField>
          <FilterField label="Reference / Check #">
            <input type="text" value={draft.referenceNumber} onChange={(e) => set('referenceNumber', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="Reference number" />
          </FilterField>

          <FilterField label="Payment Date">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={draft.paymentDateFrom} onChange={(e) => set('paymentDateFrom', e.target.value)} className={fieldCls} aria-label="Payment date from" />
              <input type="date" value={draft.paymentDateTo} onChange={(e) => set('paymentDateTo', e.target.value)} className={fieldCls} aria-label="Payment date to" />
            </div>
          </FilterField>
          <FilterField label="Scheduled Date">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={draft.scheduledDateFrom} onChange={(e) => set('scheduledDateFrom', e.target.value)} className={fieldCls} aria-label="Scheduled date from" />
              <input type="date" value={draft.scheduledDateTo} onChange={(e) => set('scheduledDateTo', e.target.value)} className={fieldCls} aria-label="Scheduled date to" />
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

          <FilterField label="Payment Method">
            <select value={draft.methodId} onChange={(e) => set('methodId', e.target.value)} className={fieldCls} aria-label="Payment method">
              <option value="">— Any —</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method.id} value={method.id}>{method.name}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Approval">
            <select value={draft.approvalStatus} onChange={(e) => set('approvalStatus', e.target.value)} className={fieldCls} aria-label="Approval status">
              <option value="">— Any —</option>
              {APPROVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
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
