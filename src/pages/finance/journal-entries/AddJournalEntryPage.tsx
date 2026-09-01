import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, AlertCircle, Loader2, Save } from 'lucide-react';
import { journalEntryService } from '@/services/journalEntryService';
import { lookupService } from '@/services/lookupService';
import { workflowService } from '@/services/tenantServices';
import { activeCustomFields } from '@/lib/customFields';
import { apiErrorMessage } from '@/api/tenantClient';
import { cn } from '@/lib/utils';
import { fieldLabelCls } from '@/components/crm/formUtils';
import { ModernSection, FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { AccountPicker, type AccountRef } from '@/components/finance/AccountPicker';
import { JournalEntrySectionGrid } from './components/JournalEntryFormFields';
import {
  JOURNAL_ENTRY_CREATE_FIELDS, journalEntryDefaults, toCreatePayload, PAGE_TABS, type PageTab,
} from '@/lib/journalEntryForm';

const BANK_CASH_TYPES = ['bank', 'cash'] as const;

export default function AddJournalEntryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);

  const [activeTab, setActiveTab] = useState<PageTab>('details');
  const [data, setData] = useState<Record<string, unknown>>(journalEntryDefaults());
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [fromAccount, setFromAccount] = useState<AccountRef | null>(null);
  const [toAccount, setToAccount] = useState<AccountRef | null>(null);

  const set = (key: string, value: unknown) => setData((d) => ({ ...d, [key]: value }));
  const setCustomField = (key: string, value: unknown) =>
    setCustomFieldValues((c) => ({ ...c, [key]: value }));

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const jeWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'cash_transfer');
  const { data: jeDef } = useQuery({
    queryKey: ['workflow', jeWorkflow?.id],
    queryFn: () => workflowService.get(jeWorkflow?.id ?? ''),
    enabled: Boolean(jeWorkflow?.id),
  });
  const customFieldDefs = activeCustomFields(jeDef);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!fromAccount || !toAccount) throw new Error('A From and To account are required.');
      const payload = toCreatePayload(fromAccount.id, toAccount.id, data, customFieldValues);
      return journalEntryService.createJournalEntry(payload);
    },
    onSuccess: async (je) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(je.id); } catch { /* non-fatal */ }
      }
      navigate('/finance/journal-entries');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">

        <CrmPageHeader
          backLabel="Journal Entries"
          onBack={() => navigate('/finance/journal-entries')}
          icon={ArrowLeftRight}
          title="New Journal Entry"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Journal Entry'}
            </button>
          )}
        />

        {saveError && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(saveError, 'Failed to save journal entry.')}
            </p>
          </div>
        )}

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
                <ModernSection title="Transfer" index={0}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={fieldLabelCls}>From Account <span className="text-red-400">*</span></label>
                      <AccountPicker
                        value={fromAccount}
                        onChange={setFromAccount}
                        options={{
                          required: true,
                          types: [...BANK_CASH_TYPES],
                          placeholder: 'Search Bank/Cash accounts…',
                          ariaLabel: 'Search From account',
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={fieldLabelCls}>To Account <span className="text-red-400">*</span></label>
                      <AccountPicker
                        value={toAccount}
                        onChange={setToAccount}
                        options={{
                          required: true,
                          types: [...BANK_CASH_TYPES],
                          placeholder: 'Search Bank/Cash accounts…',
                          ariaLabel: 'Search To account',
                        }}
                      />
                    </div>
                  </div>
                  {fromAccount && toAccount && fromAccount.id === toAccount.id && (
                    <p className="mt-2 text-2xs text-destructive">Source and destination accounts must be different.</p>
                  )}
                </ModernSection>

                <ModernSection title="Journal Entry Details" index={1}>
                  <JournalEntrySectionGrid fields={JOURNAL_ENTRY_CREATE_FIELDS} data={data} set={set} lookups={lookups} />
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
              </>
            )}

            {activeTab === 'audit' && (
              <p className="py-12 text-center text-sm text-stone-400">
                Audit trail will be available after saving the journal entry.
              </p>
            )}

            {/* Always mounted so staged files survive tab switches */}
            <div className={activeTab === 'files' ? '' : 'hidden'}>
              <EditableFilesPanel ref={panelRef} />
            </div>
          </div>
        </div>

        <FormActionBar
          onCancel={() => navigate('/finance/journal-entries')}
          isPending={isPending}
          submitLabel="Save Journal Entry"
        />
      </form>
    </div>
  );
}
