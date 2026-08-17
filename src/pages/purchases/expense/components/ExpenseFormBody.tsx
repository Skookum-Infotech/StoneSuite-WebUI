import type { Ref } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { workflowService } from '@/services/tenantServices';
import { ExpenseSectionGrid } from './ExpenseFormFields';
import { ExpenseSummaryCard } from './ExpenseSummaryCard';
import { ExpenseLinesTable } from './ExpenseLinesTable';
import { ExpenseAuditTab } from './ExpenseAuditTab';
import { cn } from '@/lib/utils';
import {
  PRIMARY_INFO_FIELDS, PAGE_TABS, type PageTab, type ExpenseLineItem,
} from '@/lib/expenseForm';

// Shared tab bar + tab content for both the Add and Edit Expense pages —
// mirrors RequisitionFormBody. Custom fields render from the `expense`
// legacy workflow's field definitions (DynamicFieldInput), same as
// Requisition. There is no claimant field and no vendor/tax section (spec
// AD-2/AD-3) — the header is just Department + Memo.
export function ExpenseFormBody({
  activeTab, setActiveTab, expenseId,
  data, set, lineItems, setLineItems,
  customFieldValues, setCustomField,
  total, filesPanelRef,
}: {
  activeTab: PageTab;
  setActiveTab: (t: PageTab) => void;
  /** Present only once the expense claim is persisted (edit mode) — gates the
   *  Audit tab and switches Files to immediate-upload mode. */
  expenseId?: string;
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lineItems: ExpenseLineItem[];
  setLineItems: (v: ExpenseLineItem[]) => void;
  customFieldValues: Record<string, unknown>;
  setCustomField: (key: string, value: unknown) => void;
  total: number;
  filesPanelRef?: Ref<EditableFilesPanelHandle>;
}) {
  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const expWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'expense');
  const { data: expDef } = useQuery({
    queryKey: ['workflow', expWorkflow?.id],
    queryFn: () => workflowService.get(expWorkflow?.id ?? ''),
    enabled: Boolean(expWorkflow?.id),
  });
  const customFieldDefs = expDef?.fields ?? [];

  return (
    <>
      {/* Page-level tab bar */}
      <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-10 4xl:px-16 modal-scrollbar">
        {PAGE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            aria-label={`${tab.label} tab`}
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
                    <ExpenseSectionGrid fields={PRIMARY_INFO_FIELDS} data={data} set={set} />
                  </div>
                  <div className="w-full lg:w-56 shrink-0">
                    <ExpenseSummaryCard total={total} />
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

              <ModernSection title="Expense Lines" index={2}>
                <ExpenseLinesTable items={lineItems} onUpdate={setLineItems} />
              </ModernSection>
            </>
          )}

          {activeTab === 'audit' && <ExpenseAuditTab expenseId={expenseId} />}

          {/* Always mounted so staged files / edits survive tab switches */}
          <div className={activeTab === 'files' ? '' : 'hidden'}>
            <EditableFilesPanel ref={filesPanelRef} recordId={expenseId} />
          </div>
        </div>
      </div>
    </>
  );
}
