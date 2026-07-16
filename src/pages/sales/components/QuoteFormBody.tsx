import type { Ref, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModernSection, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { readonlyCls } from '@/components/crm/formUtils';
import { CustomerPicker, type CustomerRef } from './CustomerPicker';
import { QuoteSectionGrid } from './QuoteFormFields';
import { QuoteSummaryCard } from './QuoteSummaryCard';
import { QuoteItemsTab } from './QuoteItemsTab';
import { QuoteAuditTab } from './QuoteAuditTab';
import type { CrmLookups } from '@/services/lookupService';
import {
  PRIMARY_INFO_FIELDS, BILL_TO_FIELDS, SHIP_TO_FIELDS, SALES_INFO_FIELDS,
  PAGE_TABS, type PageTab, type QuoteLineItem,
} from '@/lib/quoteForm';

// Shared tab bar + tab content for both the Add and Edit Quote pages —
// mirrors EstimateFormBody. Takes more props than CLAUDE.md's 5-prop
// guideline — see the plan's Global Constraints on why that's an accepted,
// pre-existing convention across this whole Sales form-body family.
export function QuoteFormBody({
  activeTab, setActiveTab, quoteId,
  data, set, lineItems, setLineItems,
  customer, setCustomer, customerLocked = false,
  lookups, subtotal, discountAmt, taxTotal, total, filesPanelRef, statusControl,
  approvalControl, sourceEstimate,
}: {
  activeTab: PageTab;
  setActiveTab: (t: PageTab) => void;
  /** Present only once the quote is persisted (edit mode) — gates the
   *  Audit tab and switches Files to immediate-upload mode. */
  quoteId?: string;
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lineItems: QuoteLineItem[];
  setLineItems: (v: QuoteLineItem[]) => void;
  customer: CustomerRef | null;
  setCustomer: (c: CustomerRef | null) => void;
  /** The customer is fixed after creation — edit mode shows it read-only
   *  instead of the picker. */
  customerLocked?: boolean;
  lookups?: CrmLookups;
  subtotal: number; discountAmt: number; taxTotal: number; total: number;
  filesPanelRef?: Ref<EditableFilesPanelHandle>;
  /** Interactive status control (edit mode only) — a new quote always starts
   *  at Draft, so create mode omits this and shows a plain "Draft" display. */
  statusControl?: ReactNode;
  /** Approve-sign-off action (edit mode only, shown by the page when
   *  statusCode === QUOTE_APPROVAL_PENDING_STATUS). */
  approvalControl?: ReactNode;
  /** The estimate this quote was converted from, if any — renders a
   *  read-only link (plan Decision #1/§ ticket item). */
  sourceEstimate?: { id: string; number: string } | null;
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
              <ModernSection title="Primary Information" index={0}>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                      <ModernFieldShell label="Quote Status">
                        {statusControl ?? (
                          <div className={cn(readonlyCls, 'cursor-not-allowed select-none')}>Draft</div>
                        )}
                      </ModernFieldShell>
                      {sourceEstimate && (
                        <ModernFieldShell label="Source Estimate">
                          <Link
                            to={`/sales/estimate/${sourceEstimate.id}`}
                            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-stone-300 bg-stone-50 px-3.5 text-xs font-semibold text-accent-foreground hover:bg-stone-100 transition-colors"
                          >
                            <FileSpreadsheet className="size-3.5" />
                            {sourceEstimate.number}
                          </Link>
                        </ModernFieldShell>
                      )}
                    </div>
                    {approvalControl && <div className="pt-1">{approvalControl}</div>}
                    <QuoteSectionGrid
                      fields={PRIMARY_INFO_FIELDS.filter((f) => f.key !== 'quote_status')}
                      data={data} set={set} lookups={lookups} maxCols={2}
                    />
                  </div>
                  <div className="w-full lg:w-56 shrink-0">
                    <QuoteSummaryCard subtotal={subtotal} discountAmt={discountAmt} taxTotal={taxTotal} total={total} />
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
                  <QuoteSectionGrid fields={BILL_TO_FIELDS} data={data} set={set} lookups={lookups} />
                </div>
              </ModernSection>
              <ModernSection title="Ship To" index={2}>
                <QuoteSectionGrid fields={SHIP_TO_FIELDS} data={data} set={set} lookups={lookups} />
              </ModernSection>
              <ModernSection title="Sales Fields" index={3}>
                <QuoteSectionGrid fields={SALES_INFO_FIELDS} data={data} set={set} lookups={lookups} />
              </ModernSection>
              <ModernSection title="Items" index={4}>
                <QuoteItemsTab items={lineItems} onUpdate={setLineItems} headerTaxPercent={headerTaxPercent} />
              </ModernSection>
            </>
          )}

          {activeTab === 'audit' && <QuoteAuditTab quoteId={quoteId} />}

          {/* Always mounted so staged files / edits survive tab switches */}
          <div className={activeTab === 'files' ? '' : 'hidden'}>
            <EditableFilesPanel ref={filesPanelRef} recordId={quoteId} />
          </div>
        </div>
      </div>
    </>
  );
}
