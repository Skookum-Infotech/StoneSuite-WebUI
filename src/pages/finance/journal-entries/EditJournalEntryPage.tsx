import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, AlertCircle, Loader2, Save } from 'lucide-react';
import { journalEntryService } from '@/services/journalEntryService';
import { lookupService } from '@/services/lookupService';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { cn } from '@/lib/utils';
import { fieldLabelCls } from '@/components/crm/formUtils';
import { FormActionBar, ModernSection } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { AccountPicker, type AccountRef } from '@/components/finance/AccountPicker';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { JournalEntrySectionGrid } from './components/JournalEntryFormFields';
import { JournalEntryAuditTab } from './components/JournalEntryAuditTab';
import {
  JOURNAL_ENTRY_FIELDS, fromJournalEntry, toUpdatePayload, PAGE_TABS, type PageTab,
} from '@/lib/journalEntryForm';

const BANK_CASH_TYPES = ['bank', 'cash'] as const;

export default function EditJournalEntryPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);

  const initialTab = (location.state as { initialTab?: PageTab } | null)?.initialTab ?? 'details';
  const [activeTab, setActiveTab] = useState<PageTab>(initialTab);
  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, unknown> | null>(null);
  const [localFromAccount, setLocalFromAccount] = useState<AccountRef | null>(null);
  const [localToAccount, setLocalToAccount] = useState<AccountRef | null>(null);

  const { data: je, isLoading, error: loadError } = useQuery({
    queryKey: ['journal-entry', id],
    queryFn: () => journalEntryService.getJournalEntry(id),
    enabled: Boolean(id),
  });

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
  const customFieldDefs = jeDef?.fields ?? [];

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (je?.transferNumber) {
      setLabel(id, je.transferNumber);
      return () => clearLabel(id);
    }
  }, [id, je?.transferNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (je ? fromJournalEntry(je) : null), [je]);
  const data = localData ?? mapped?.data ?? {};
  const customFieldValues = localCustomFields ?? mapped?.customFieldValues ?? {};
  const fromAccount = localFromAccount ?? mapped?.fromAccount ?? null;
  const toAccount = localToAccount ?? mapped?.toAccount ?? null;

  const set = useCallback(
    (key: string, value: unknown) => setLocalData((prev) => ({ ...(prev ?? mapped?.data ?? {}), [key]: value })),
    [mapped],
  );
  const setCustomField = useCallback(
    (key: string, value: unknown) =>
      setLocalCustomFields((prev) => ({ ...(prev ?? mapped?.customFieldValues ?? {}), [key]: value })),
    [mapped],
  );

  const save = useMutation({
    mutationFn: () => {
      if (!fromAccount || !toAccount) throw new Error('A From and To account are required.');
      return journalEntryService.updateJournalEntry(
        id,
        toUpdatePayload(fromAccount.id, toAccount.id, data, customFieldValues, je?.recordVersion ?? 0),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entry', id] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      navigate(`/finance/journal-entries/${id}`);
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading journal entry…" /></div>;
  if (loadError || !je) {
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load journal entry.')}</ErrorNote></div>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="flex flex-col flex-1 min-h-0">

        <CrmPageHeader
          backLabel="Journal Entries"
          onBack={() => navigate(`/finance/journal-entries/${id}`)}
          icon={ArrowLeftRight}
          title={je.transferNumber || 'Journal Entry'}
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        />

        {save.error && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(save.error, 'Failed to save journal entry.')}
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
                        onChange={setLocalFromAccount}
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
                        onChange={setLocalToAccount}
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
                  <JournalEntrySectionGrid fields={JOURNAL_ENTRY_FIELDS} data={data} set={set} lookups={lookups} />
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

            {activeTab === 'audit' && <JournalEntryAuditTab journalEntryId={id} />}

            {/* Always mounted so staged files survive tab switches */}
            <div className={activeTab === 'files' ? '' : 'hidden'}>
              <EditableFilesPanel ref={panelRef} recordId={id} />
            </div>
          </div>
        </div>

        <FormActionBar
          onCancel={() => navigate(`/finance/journal-entries/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
