import type { Ref, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ModernSection, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { readonlyCls } from '@/components/crm/formUtils';
import { workflowService } from '@/services/tenantServices';
import { activeCustomFields } from '@/lib/customFields';
import { CustomerPicker, type CustomerRef } from './CustomerPicker';
import { SOSectionGrid } from './SalesOrderFormFields';
import { SalesOrderSummaryCard } from './SalesOrderSummaryCard';
import { SalesOrderItemsTab } from './SalesOrderItemsTab';
import { SalesOrderInventoryTab } from './SalesOrderInventoryTab';
import { SalesOrderDrawingsTab } from './SalesOrderDrawingsTab';
import { SalesOrderAuditTab } from './SalesOrderAuditTab';
import type { CrmLookups } from '@/services/lookupService';
import {
  PRIMARY_INFO_FIELDS, BILL_TO_FIELDS, SHIP_TO_FIELDS, SALES_INFO_FIELDS,
  PAGE_TABS, type PageTab, type SOLineItem, type SODrawing,
} from '@/lib/salesOrderForm';

// Shared tab bar + tab content for both the Add and Edit Sales Order pages —
// mirrors the CRM Add/Edit split (CrmRecordForm reused by both), extended
// with Sales-Order-specific tabs (Inventory/Drawings) that only have live
// data once an order exists (orderId set).
export function SalesOrderFormBody({
  activeTab, setActiveTab, orderId,
  data, set, lineItems, setLineItems, drawings, setDrawings,
  customer, setCustomer, customerLocked = false,
  customFieldValues, setCustomField,
  lookups, subtotal, discountAmt, taxTotal, total, filesPanelRef, statusControl,
}: {
  activeTab: PageTab;
  setActiveTab: (t: PageTab) => void;
  /** Present only once the order is persisted (edit mode) — gates
   *  Inventory/Audit tabs and switches Files to immediate-upload mode. */
  orderId?: string;
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lineItems: SOLineItem[];
  setLineItems: (v: SOLineItem[]) => void;
  drawings: SODrawing[];
  setDrawings: (v: SODrawing[]) => void;
  customer: CustomerRef | null;
  setCustomer: (c: CustomerRef | null) => void;
  /** The customer is fixed after creation (UpdateOrderInput has no
   *  customerUuid) — edit mode shows it read-only instead of the picker. */
  customerLocked?: boolean;
  customFieldValues: Record<string, unknown>;
  setCustomField: (key: string, value: unknown) => void;
  lookups?: CrmLookups;
  subtotal: number; discountAmt: number; taxTotal: number; total: number;
  filesPanelRef?: Ref<EditableFilesPanelHandle>;
  /** Interactive status control (edit mode only) — a new order always starts
   *  at Draft, so create mode omits this and shows a plain "Draft" display. */
  statusControl?: ReactNode;
}) {
  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const soWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'sales_order');
  const { data: soDef } = useQuery({
    queryKey: ['workflow', soWorkflow?.id],
    queryFn: () => workflowService.get(soWorkflow?.id ?? ''),
    enabled: Boolean(soWorkflow?.id),
  });
  const customFieldDefs = activeCustomFields(soDef);

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
            {tab.key === 'drawings' && drawings.length > 0 && (
              <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-2xs font-bold text-stone-500 tabular-nums">
                {drawings.length}
              </span>
            )}
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
                      <ModernFieldShell label="Sales Order Status">
                        {statusControl ?? (
                          <div className={cn(readonlyCls, 'cursor-not-allowed select-none')}>Draft</div>
                        )}
                      </ModernFieldShell>
                    </div>
                    <SOSectionGrid
                      fields={PRIMARY_INFO_FIELDS.filter((f) => f.key !== 'sales_order_status')}
                      data={data} set={set} lookups={lookups} maxCols={2}
                    />
                  </div>
                  <div className="w-full lg:w-56 shrink-0">
                    <SalesOrderSummaryCard subtotal={subtotal} discountAmt={discountAmt} taxTotal={taxTotal} total={total} />
                  </div>
                </div>
              </ModernSection>
              <ModernSection title="Bill To" index={1}>
                <div className="space-y-4">
                  <ModernFieldShell label="Billing Customer" required={!customerLocked}>
                    {customerLocked ? (
                      <div className={cn(readonlyCls, 'cursor-not-allowed select-none')}>
                        {customer?.name || <span className="text-stone-400">—</span>}
                      </div>
                    ) : (
                      <CustomerPicker value={customer} onChange={setCustomer} required />
                    )}
                  </ModernFieldShell>
                  <SOSectionGrid fields={BILL_TO_FIELDS} data={data} set={set} lookups={lookups} />
                </div>
              </ModernSection>
              <ModernSection title="Ship To" index={2}>
                <SOSectionGrid fields={SHIP_TO_FIELDS} data={data} set={set} lookups={lookups} />
              </ModernSection>
              <ModernSection title="Sales Fields" index={3}>
                <SOSectionGrid fields={SALES_INFO_FIELDS} data={data} set={set} lookups={lookups} />
              </ModernSection>

              {customFieldDefs.length > 0 && (
                <ModernSection title="Custom Fields" index={4}>
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

              <ModernSection title="Items" index={5}>
                <SalesOrderItemsTab items={lineItems} onUpdate={setLineItems} />
              </ModernSection>
            </>
          )}

          {activeTab === 'inventory' && <SalesOrderInventoryTab orderId={orderId} />}

          {activeTab === 'drawings' && (
            <SalesOrderDrawingsTab drawings={drawings} onUpdate={setDrawings} />
          )}

          {activeTab === 'audit' && <SalesOrderAuditTab orderId={orderId} />}

          {/* Always mounted so staged files / edits survive tab switches */}
          <div className={activeTab === 'files' ? '' : 'hidden'}>
            <EditableFilesPanel ref={filesPanelRef} recordId={orderId} />
          </div>
        </div>
      </div>
    </>
  );
}
