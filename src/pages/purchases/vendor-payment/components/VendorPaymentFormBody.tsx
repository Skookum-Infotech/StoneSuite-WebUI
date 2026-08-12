import type { ReactNode, Ref } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ModernSection, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { readonlyCls } from '@/components/crm/formUtils';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { workflowService } from '@/services/tenantServices';
import { VendorPicker, type VendorRef } from '@/pages/purchases/purchase-order/components/VendorPicker';
import { VendorPaymentSectionGrid } from './VendorPaymentFormFields';
import { VendorPaymentAuditTab } from './VendorPaymentAuditTab';
import type { CrmLookups } from '@/services/lookupService';
import type { VendorPaymentFormField, PageTab } from '@/lib/vendorPaymentForm';
import { PAGE_TABS } from '@/lib/vendorPaymentForm';

/** Page chrome: which tab is showing, and (once persisted) the record id that
 *  gates the Audit tab and switches Files to immediate-upload mode. */
export interface VendorPaymentShell {
  activeTab: PageTab;
  setActiveTab: (t: PageTab) => void;
  vendorPaymentId?: string;
}

/** Everything the editable grid needs, including the workflow's custom-field
 *  values — they're form state too, just rendered from runtime definitions. */
export interface VendorPaymentFormState {
  fields: VendorPaymentFormField[];
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
  customFieldValues: Record<string, unknown>;
  setCustomField: (key: string, value: unknown) => void;
  /** Shown read-only beside the vendor on Edit — the amount is immutable
   *  post-creation, so it leaves the editable grid entirely. */
  lockedAmount?: number;
}

/** The vendor is fixed at creation (UpdateVendorPaymentPayload carries no
 *  vendorUuid), so Edit renders it read-only instead of the picker. */
export interface VendorPaymentVendorState {
  value: VendorRef | null;
  onChange: (v: VendorRef | null) => void;
  locked?: boolean;
}

// Shared tab bar + tab content for both the Add and Edit Vendor Payment pages
// — mirrors VendorBillFormBody, minus the line-items tab (a payment is one
// amount, spread across bills through the application ledger rather than
// itemised). Related props are grouped into state objects to stay inside the
// project's five-prop ceiling; `children` is where the Add page slots its
// create-only "Apply to Bills" section.
export function VendorPaymentFormBody({ shell, form, vendor, filesPanelRef, children }: {
  shell: VendorPaymentShell;
  form: VendorPaymentFormState;
  vendor: VendorPaymentVendorState;
  filesPanelRef?: Ref<EditableFilesPanelHandle>;
  children?: ReactNode;
}) {
  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const vpWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'vendor_payment');
  const { data: vpDef } = useQuery({
    queryKey: ['workflow', vpWorkflow?.id],
    queryFn: () => workflowService.get(vpWorkflow?.id ?? ''),
    enabled: Boolean(vpWorkflow?.id),
  });
  const customFieldDefs = vpDef?.fields ?? [];

  return (
    <>
      {/* Page-level tab bar */}
      <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-10 4xl:px-16 modal-scrollbar">
        {PAGE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => shell.setActiveTab(tab.key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              shell.activeTab === tab.key
                ? 'border-stone-800 text-stone-900'
                : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto modal-scrollbar">
        <div className="px-4 py-3 pb-24 space-y-2 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">

          {shell.activeTab === 'details' && (
            <>
              <ModernSection title="Primary Information" index={0}>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                    <ModernFieldShell label="Vendor" required={!vendor.locked}>
                      {vendor.locked ? (
                        <div className={cn(readonlyCls, 'cursor-not-allowed select-none')}>
                          {vendor.value?.name || <span className="text-stone-400">—</span>}
                        </div>
                      ) : (
                        <VendorPicker value={vendor.value} onChange={vendor.onChange} required />
                      )}
                    </ModernFieldShell>
                    {form.lockedAmount !== undefined && (
                      <ModernFieldShell label="Amount">
                        <div className={cn(readonlyCls, 'cursor-not-allowed select-none tabular-nums')}>
                          {form.lockedAmount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                        </div>
                      </ModernFieldShell>
                    )}
                  </div>
                  <VendorPaymentSectionGrid
                    fields={form.fields}
                    data={form.data}
                    set={form.set}
                    lookups={form.lookups}
                  />
                </div>
              </ModernSection>

              {customFieldDefs.length > 0 && (
                <ModernSection title="Custom Fields" index={1}>
                  <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                    {customFieldDefs.map((def) => (
                      <DynamicFieldInput
                        key={def.id}
                        field={def}
                        value={form.customFieldValues[def.key]}
                        onChange={form.setCustomField}
                      />
                    ))}
                  </div>
                </ModernSection>
              )}

              {children}
            </>
          )}

          {shell.activeTab === 'audit' && <VendorPaymentAuditTab vendorPaymentId={shell.vendorPaymentId} />}

          {/* Always mounted so staged files / edits survive tab switches */}
          <div className={shell.activeTab === 'files' ? '' : 'hidden'}>
            <EditableFilesPanel ref={filesPanelRef} recordId={shell.vendorPaymentId} />
          </div>
        </div>
      </div>
    </>
  );
}
