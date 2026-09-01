import type { ReactNode, Ref } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ModernSection, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { readonlyCls } from '@/components/crm/formUtils';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { workflowService } from '@/services/tenantServices';
import { activeCustomFields } from '@/lib/customFields';
import { VendorPicker, type VendorRef } from '@/pages/purchases/purchase-order/components/VendorPicker';
import { VendorCreditSectionGrid } from './VendorCreditFormFields';
import { VendorCreditAuditTab } from './VendorCreditAuditTab';
import type { CrmLookups } from '@/services/lookupService';
import type { VendorCreditFormField, PageTab } from '@/lib/vendorCreditForm';
import { PAGE_TABS } from '@/lib/vendorCreditForm';

/** Page chrome: which tab is showing, and (once persisted) the record id that
 *  gates the Audit tab and switches Files to immediate-upload mode. */
export interface VendorCreditShell {
  activeTab: PageTab;
  setActiveTab: (t: PageTab) => void;
  vendorCreditId?: string;
}

/** Everything the editable grid needs, including the workflow's custom-field
 *  values — they're form state too, just rendered from runtime definitions. */
export interface VendorCreditFormState {
  fields: VendorCreditFormField[];
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
  customFieldValues: Record<string, unknown>;
  setCustomField: (key: string, value: unknown) => void;
}

/** The vendor is fixed at creation (UpdateVendorCreditPayload carries no
 *  vendorUuid), so Edit renders it read-only instead of the picker. */
export interface VendorCreditVendorState {
  value: VendorRef | null;
  onChange: (v: VendorRef | null) => void;
  locked?: boolean;
}

// Shared tab bar + tab content for both the Add and Edit Vendor Credit pages
// — mirrors VendorPaymentFormBody, minus the locked-amount slot (unlike
// Vendor Payment, amount stays editable on Vendor Credit's own grid, backend
// §8). Related props are grouped into state objects to stay inside the
// project's five-prop ceiling.
export function VendorCreditFormBody({ shell, form, vendor, filesPanelRef, children }: {
  shell: VendorCreditShell;
  form: VendorCreditFormState;
  vendor: VendorCreditVendorState;
  filesPanelRef?: Ref<EditableFilesPanelHandle>;
  children?: ReactNode;
}) {
  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const vcWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'vendor_credit');
  const { data: vcDef } = useQuery({
    queryKey: ['workflow', vcWorkflow?.id],
    queryFn: () => workflowService.get(vcWorkflow?.id ?? ''),
    enabled: Boolean(vcWorkflow?.id),
  });
  const customFieldDefs = activeCustomFields(vcDef);

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
                  </div>
                  <VendorCreditSectionGrid
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

          {shell.activeTab === 'audit' && <VendorCreditAuditTab vendorCreditId={shell.vendorCreditId} />}

          {/* Always mounted so staged files / edits survive tab switches */}
          <div className={shell.activeTab === 'files' ? '' : 'hidden'}>
            <EditableFilesPanel ref={filesPanelRef} recordId={shell.vendorCreditId} />
          </div>
        </div>
      </div>
    </>
  );
}
