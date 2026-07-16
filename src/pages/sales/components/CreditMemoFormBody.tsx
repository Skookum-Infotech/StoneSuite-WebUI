import type { Ref } from 'react';
import { cn } from '@/lib/utils';
import { ModernSection, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { readonlyCls } from '@/components/crm/formUtils';
import { CustomerPicker, type CustomerRef } from './CustomerPicker';
import { InvoicePicker, type InvoiceRef } from './InvoicePicker';
import { SalesOrderPicker, type SalesOrderRef } from './SalesOrderPicker';
import { CreditMemoSectionGrid } from './CreditMemoFormFields';
import { CreditMemoSummaryCard } from './CreditMemoSummaryCard';
import { CreditMemoItemsTab } from './CreditMemoItemsTab';
import { CreditMemoAuditTab } from './CreditMemoAuditTab';
import type { CrmLookups } from '@/services/lookupService';
import {
  PRIMARY_INFO_FIELDS, BILLING_FIELDS,
  PAGE_TABS, type PageTab, type CreditMemoLineItem,
} from '@/lib/creditMemoForm';

// Shared tab bar + tab content for both the Add and Edit Credit Memo pages —
// mirrors InvoiceFormBody, extended with the optional Invoice/Sales Order
// lineage pickers and gated "money field" disabling for the Edit page.
export function CreditMemoFormBody({
  activeTab, setActiveTab, creditMemoId,
  data, set, lineItems, setLineItems,
  customer, setCustomer, customerLocked = false,
  invoice, setInvoice, invoiceLocked = false,
  salesOrder, setSalesOrder, salesOrderLocked = false,
  lookups, subtotal, discountAmt, taxTotal, adjustment, total, appliedTotal,
  filesPanelRef, moneyFieldsDisabled = false,
}: {
  activeTab: PageTab;
  setActiveTab: (t: PageTab) => void;
  /** Present only once the credit memo is persisted (edit mode) — gates the
   *  Audit tab and switches Files to immediate-upload mode. */
  creditMemoId?: string;
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lineItems: CreditMemoLineItem[];
  setLineItems: (v: CreditMemoLineItem[]) => void;
  customer: CustomerRef | null;
  setCustomer: (c: CustomerRef | null) => void;
  /** The customer is fixed after creation — edit mode shows it read-only. */
  customerLocked?: boolean;
  invoice: InvoiceRef | null;
  setInvoice: (i: InvoiceRef | null) => void;
  invoiceLocked?: boolean;
  salesOrder: SalesOrderRef | null;
  setSalesOrder: (s: SalesOrderRef | null) => void;
  salesOrderLocked?: boolean;
  lookups?: CrmLookups;
  subtotal: number; discountAmt: number; taxTotal: number; adjustment: number; total: number;
  appliedTotal: number;
  filesPanelRef?: Ref<EditableFilesPanelHandle>;
  /** Disables lines/sales-tax/adjustment (Edit page only, once the credit
   *  memo has left DRFT — spec: "Disable money fields when status != DRFT"). */
  moneyFieldsDisabled?: boolean;
}) {
  const headerTaxPercent = parseFloat(String(data.sales_tax_pct ?? '')) || 0;

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
              <ModernSection title="Customer" index={0}>
                <ModernFieldShell label="Customer" required={!customerLocked}>
                  {customerLocked ? (
                    <div className={cn(readonlyCls, 'cursor-not-allowed select-none')}>
                      {customer?.name || <span className="text-stone-400">—</span>}
                    </div>
                  ) : (
                    <CustomerPicker value={customer} onChange={setCustomer} required />
                  )}
                </ModernFieldShell>
              </ModernSection>

              <ModernSection title="Linked Documents (optional)" index={1}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                  <ModernFieldShell label="Invoice">
                    {invoiceLocked ? (
                      <div className={cn(readonlyCls, 'cursor-not-allowed select-none')}>
                        {invoice?.number || <span className="text-stone-400">—</span>}
                      </div>
                    ) : (
                      <InvoicePicker customer={customer} value={invoice} onChange={setInvoice} />
                    )}
                  </ModernFieldShell>
                  <ModernFieldShell label="Sales Order">
                    {salesOrderLocked ? (
                      <div className={cn(readonlyCls, 'cursor-not-allowed select-none')}>
                        {salesOrder?.number || <span className="text-stone-400">—</span>}
                      </div>
                    ) : (
                      <SalesOrderPicker customer={customer} value={salesOrder} onChange={setSalesOrder} />
                    )}
                  </ModernFieldShell>
                </div>
              </ModernSection>

              <ModernSection title="Primary Information" index={2}>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                  <div className="flex-1 min-w-0 space-y-4">
                    <CreditMemoSectionGrid
                      fields={PRIMARY_INFO_FIELDS.filter((f) => f.key !== 'credit_memo_status')}
                      data={data} set={set} lookups={lookups} maxCols={2}
                      moneyFieldsDisabled={moneyFieldsDisabled}
                    />
                  </div>
                  <div className="w-full lg:w-56 shrink-0">
                    <CreditMemoSummaryCard subtotal={subtotal} discountAmt={discountAmt} taxTotal={taxTotal} adjustment={adjustment} total={total} appliedTotal={appliedTotal} />
                  </div>
                </div>
              </ModernSection>

              <ModernSection title="Billing Address" index={3}>
                <CreditMemoSectionGrid fields={BILLING_FIELDS} data={data} set={set} lookups={lookups} />
              </ModernSection>

              <ModernSection title="Items" index={4}>
                <CreditMemoItemsTab items={lineItems} onUpdate={setLineItems} headerTaxPercent={headerTaxPercent} disabled={moneyFieldsDisabled} />
              </ModernSection>
            </>
          )}

          {activeTab === 'audit' && <CreditMemoAuditTab creditMemoId={creditMemoId} />}

          {/* Always mounted so staged files / edits survive tab switches */}
          <div className={activeTab === 'files' ? '' : 'hidden'}>
            <EditableFilesPanel ref={filesPanelRef} recordId={creditMemoId} />
          </div>
        </div>
      </div>
    </>
  );
}
