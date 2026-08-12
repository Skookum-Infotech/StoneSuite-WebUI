import type { Ref } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ModernSection, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { readonlyCls } from '@/components/crm/formUtils';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { workflowService } from '@/services/tenantServices';
import { VendorPicker, type VendorRef } from '@/pages/purchases/purchase-order/components/VendorPicker';
import { VendorBillSectionGrid } from './VendorBillFormFields';
import { VendorBillSummaryCard } from './VendorBillSummaryCard';
import { VendorBillItemsTab } from './VendorBillItemsTab';
import { VendorBillAuditTab } from './VendorBillAuditTab';
import type { CrmLookups } from '@/services/lookupService';
import {
  PRIMARY_INFO_FIELDS, PAGE_TABS, type PageTab, type VendorBillLineItem,
} from '@/lib/vendorBillForm';

// Shared tab bar + tab content for both the Add and Edit Vendor Bill pages —
// mirrors PurchaseOrderFormBody. No Ship To section (vendor bills carry no
// address block). Custom fields render from the `vendor_bill` workflow's
// field definitions (DynamicFieldInput).
export function VendorBillFormBody({
  activeTab, setActiveTab, vendorBillId,
  data, set, lineItems, setLineItems,
  vendor, setVendor, vendorLocked = false,
  customFieldValues, setCustomField,
  lookups, subtotal, discountAmt, taxTotal, adjustment, total, filesPanelRef,
}: {
  activeTab: PageTab;
  setActiveTab: (t: PageTab) => void;
  /** Present only once the vendor bill is persisted (edit mode) — gates the
   *  Audit tab and switches Files to immediate-upload mode. */
  vendorBillId?: string;
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lineItems: VendorBillLineItem[];
  setLineItems: (v: VendorBillLineItem[]) => void;
  vendor: VendorRef | null;
  setVendor: (v: VendorRef | null) => void;
  /** The vendor is fixed after creation (UpdateVendorBillPayload has no
   *  vendorUuid) — edit mode shows it read-only instead of the picker. */
  vendorLocked?: boolean;
  customFieldValues: Record<string, unknown>;
  setCustomField: (key: string, value: unknown) => void;
  lookups?: CrmLookups;
  subtotal: number; discountAmt: number; taxTotal: number;
  adjustment: number; total: number;
  filesPanelRef?: Ref<EditableFilesPanelHandle>;
}) {
  const headerTaxPercent = parseFloat(String(data.sales_tax_pct ?? '')) || 0;

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const vbWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'vendor_bill');
  const { data: vbDef } = useQuery({
    queryKey: ['workflow', vbWorkflow?.id],
    queryFn: () => workflowService.get(vbWorkflow?.id ?? ''),
    enabled: Boolean(vbWorkflow?.id),
  });
  const customFieldDefs = vbDef?.fields ?? [];

  return (
    <>
      {/* Page-level tab bar */}
      <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-10 4xl:px-16 modal-scrollbar">
        {PAGE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              activeTab === tab.key
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

          {activeTab === 'details' && (
            <>
              <ModernSection title="Primary Information" index={0}>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                      <ModernFieldShell label="Vendor" required={!vendorLocked}>
                        {vendorLocked ? (
                          <div className={cn(readonlyCls, 'cursor-not-allowed select-none')}>
                            {vendor?.name || <span className="text-stone-400">—</span>}
                          </div>
                        ) : (
                          <VendorPicker value={vendor} onChange={setVendor} required />
                        )}
                      </ModernFieldShell>
                      <ModernFieldShell label="Vendor Bill Status">
                        <div className={cn(readonlyCls, 'cursor-not-allowed select-none')}>Draft</div>
                      </ModernFieldShell>
                    </div>
                    <VendorBillSectionGrid
                      fields={PRIMARY_INFO_FIELDS.filter((f) => f.key !== 'vb_status')}
                      data={data} set={set} lookups={lookups}
                    />
                  </div>
                  <div className="w-full lg:w-56 shrink-0">
                    <VendorBillSummaryCard
                      subtotal={subtotal} discountAmt={discountAmt} taxTotal={taxTotal}
                      adjustment={adjustment} total={total}
                    />
                  </div>
                </div>
              </ModernSection>
              {customFieldDefs.length > 0 && (
                <ModernSection title="Custom Fields" index={1}>
                  <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                    {customFieldDefs.map((def) => (
                      <DynamicFieldInput
                        key={def.id}
                        field={def}
                        value={customFieldValues[def.key]}
                        onChange={setCustomField}
                      />
                    ))}
                  </div>
                </ModernSection>
              )}
              <ModernSection title="Items" index={2}>
                <VendorBillItemsTab items={lineItems} onUpdate={setLineItems} headerTaxPercent={headerTaxPercent} />
              </ModernSection>
            </>
          )}

          {activeTab === 'audit' && <VendorBillAuditTab vendorBillId={vendorBillId} />}

          {/* Always mounted so staged files / edits survive tab switches */}
          <div className={activeTab === 'files' ? '' : 'hidden'}>
            <EditableFilesPanel ref={filesPanelRef} recordId={vendorBillId} />
          </div>
        </div>
      </div>
    </>
  );
}
