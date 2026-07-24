import type { Ref } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { workflowService } from '@/services/tenantServices';
import { ItemReceiptSectionGrid } from './ItemReceiptFormFields';
import { ReceiptLinesTable } from './ReceiptLinesTable';
import { ItemReceiptAuditTab } from './ItemReceiptAuditTab';
import type { CrmLookups } from '@/services/lookupService';
import {
  RECEIPT_HEADER_FIELDS, PAGE_TABS, type PageTab, type ItemReceiptDraftLine,
} from '@/lib/itemReceiptForm';

// Shared tab bar + tab content for both the Receive and Edit Item Receipt
// pages — mirrors PurchaseOrderFormBody. Custom fields render from the
// `item_receipt` workflow's field definitions (DynamicFieldInput).
export function ItemReceiptFormBody({
  activeTab, setActiveTab, itemReceiptId,
  data, set, lines, setLines,
  sourcePurchaseOrder,
  customFieldValues, setCustomField,
  lookups, filesPanelRef,
}: {
  activeTab: PageTab;
  setActiveTab: (t: PageTab) => void;
  /** Present only once the receipt is persisted (edit mode) — gates the
   *  Audit tab and switches Files to immediate-upload mode. */
  itemReceiptId?: string;
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lines: ItemReceiptDraftLine[];
  setLines: (v: ItemReceiptDraftLine[]) => void;
  sourcePurchaseOrder: { id: string; number?: string; vendorName: string };
  customFieldValues: Record<string, unknown>;
  setCustomField: (key: string, value: unknown) => void;
  lookups?: CrmLookups;
  filesPanelRef?: Ref<EditableFilesPanelHandle>;
}) {
  const navigate = useNavigate();

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const irWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'item_receipt');
  const { data: irDef } = useQuery({
    queryKey: ['workflow', irWorkflow?.id],
    queryFn: () => workflowService.get(irWorkflow?.id ?? ''),
    enabled: Boolean(irWorkflow?.id),
  });
  const customFieldDefs = irDef?.fields ?? [];

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
              <ModernSection title="Source Purchase Order" index={0}>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Package className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-800">{sourcePurchaseOrder.number || '—'}</p>
                      <p className="truncate text-xs text-stone-400">{sourcePurchaseOrder.vendorName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/purchases/purchase_order/${sourcePurchaseOrder.id}`)}
                    className="shrink-0 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    View order
                  </button>
                </div>
              </ModernSection>

              <ModernSection title="Receipt Information" index={1}>
                <ItemReceiptSectionGrid fields={RECEIPT_HEADER_FIELDS} data={data} set={set} lookups={lookups} />
              </ModernSection>

              {customFieldDefs.length > 0 && (
                <ModernSection title="Custom Fields" index={2}>
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

              <ModernSection title="Lines" index={3}>
                <ReceiptLinesTable lines={lines} onChange={setLines} />
              </ModernSection>
            </>
          )}

          {activeTab === 'audit' && <ItemReceiptAuditTab itemReceiptId={itemReceiptId} />}

          {/* Always mounted so staged files / edits survive tab switches */}
          <div className={activeTab === 'files' ? '' : 'hidden'}>
            <EditableFilesPanel ref={filesPanelRef} recordId={itemReceiptId} />
          </div>
        </div>
      </div>
    </>
  );
}
