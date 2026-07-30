import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Upload, Pencil, FileDown, Loader2, Landmark } from 'lucide-react';
import { journalEntryService } from '@/services/journalEntryService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { FilesContent } from '@/components/crm/CrmSubTabsPanel';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { SalesDetailSidebar } from '@/pages/sales/components/SalesDetailSidebar';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import {
  JE_STATUS_COLORS, JE_EDITABLE_STATUSES, JE_APPROVABLE_STATUSES,
  JE_POSTABLE_STATUSES, JE_REVERSIBLE_STATUSES, JE_CANCELLABLE_STATUSES, JE_DELETABLE_STATUSES,
} from '@/lib/journalEntryForm';
import { JournalEntryAuditTab } from './components/JournalEntryAuditTab';
import { ApproveJournalEntryDialog } from './components/ApproveJournalEntryDialog';
import { PostJournalEntryDialog } from './components/PostJournalEntryDialog';
import { ReverseJournalEntryDialog } from './components/ReverseJournalEntryDialog';
import { CancelJournalEntryDialog } from './components/CancelJournalEntryDialog';
import { DeleteJournalEntryDialog } from './components/DeleteJournalEntryDialog';
import type { JournalEntry } from '@/types/journalEntry';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
type Tab = (typeof TABS)[number]['key'];

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function currency(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function JournalEntryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('cash_transfer', 'update');
  const canDelete = permissionsLoading || hasPermission('cash_transfer', 'delete');
  const canTransition = permissionsLoading || hasPermission('cash_transfer', 'transition');

  const { data: je, isLoading, error } = useQuery({
    queryKey: ['journal-entry', id],
    queryFn: () => journalEntryService.getJournalEntry(id),
    enabled: Boolean(id),
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (je?.number) {
      setLabel(id, je.number);
      return () => clearLabel(id);
    }
  }, [id, je?.number, setLabel, clearLabel]);

  function refresh(updated: JournalEntry) {
    queryClient.setQueryData(['journal-entry', id], updated);
    queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
  }

  if (isLoading) return <div className="p-6"><Spinner label="Loading journal entry…" /></div>;
  if (error || !je) {
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load journal entry.')}</ErrorNote></div>;
  }

  const color = JE_STATUS_COLORS[je.statusCode] ?? '#a8a29e';
  const canEditHere = canEdit && JE_EDITABLE_STATUSES.has(je.statusCode);
  const canApproveHere = canTransition && JE_APPROVABLE_STATUSES.has(je.statusCode);
  const canPostHere = canTransition && JE_POSTABLE_STATUSES.has(je.statusCode);
  const canReverseHere = canTransition && JE_REVERSIBLE_STATUSES.has(je.statusCode);
  const canCancelHere = canTransition && JE_CANCELLABLE_STATUSES.has(je.statusCode);
  const canDeleteHere = canDelete && JE_DELETABLE_STATUSES.has(je.statusCode);

  async function handleExportPdf() {
    if (!je) return;
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportFinanceRecordToPdf } = await import('@/lib/financePdfExport');
      await exportFinanceRecordToPdf({
        recordType: 'journal_entry',
        title: je.number || 'Journal Entry',
        recordNumber: je.number,
        statusLabel: je.status,
        createdAt: je.createdAt,
        updatedAt: je.updatedAt,
        sections: [
          {
            title: 'Transfer Details',
            rows: [
              ['Date', fmtDate(je.transferDate)],
              ['From Account', `${je.fromAccount.code} — ${je.fromAccount.name}`],
              ['To Account', `${je.toAccount.code} — ${je.toAccount.name}`],
              ['Amount', currency(je.amount)],
              ['Reference', je.reference || ''],
              ['Notes', je.notes || ''],
              ['Internal Notes', je.internalNotes || ''],
            ],
          },
          {
            title: 'Ledger',
            rows: [
              ['Posted', fmtDateTime(je.postedAt)],
              ['Reversed', fmtDateTime(je.reversedAt)],
            ],
          },
        ],
      });
    } catch (err) {
      setExportPdfError(apiErrorMessage(err, 'Failed to export PDF.'));
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Journal Entries"
        onBack={() => navigate('/finance/journal-entries')}
        icon={ArrowLeftRight}
        title={je.number || 'Journal Entry'}
        subtitle={`${je.fromAccount.name} → ${je.toAccount.name}`}
        recordNumber={je.number}
        statusBadge={<Badge color={color}>{je.status}</Badge>}
      />

      {/* Tab bar */}
      <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-12 4xl:px-16 modal-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors duration-150 whitespace-nowrap shrink-0',
              activeTab === tab.key
                ? 'border-brand text-stone-950'
                : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 3xl:gap-10 4xl:px-16 4xl:py-10 4xl:gap-14">
        {/* Left column */}
        <div className="flex-1 space-y-3 min-w-0">
          {activeTab === 'overview' && (
            <>
              <ModernSection title="Transfer" index={0}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2.5 rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3">
                    <Landmark className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-2xs font-semibold uppercase tracking-wide text-stone-400">From</p>
                      <p className="truncate text-sm font-semibold text-stone-800">{je.fromAccount.name}</p>
                      <p className="truncate text-2xs text-stone-400 font-mono">{je.fromAccount.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3">
                    <Landmark className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-2xs font-semibold uppercase tracking-wide text-stone-400">To</p>
                      <p className="truncate text-sm font-semibold text-stone-800">{je.toAccount.name}</p>
                      <p className="truncate text-2xs text-stone-400 font-mono">{je.toAccount.code}</p>
                    </div>
                  </div>
                </div>
              </ModernSection>

              <ModernSection title="Journal Entry Information" index={1}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField label="Amount" value={currency(je.amount)} />
                  <ReadonlyField label="Date" value={fmtDate(je.transferDate)} />
                  <ReadonlyField label="Reference" value={je.reference} />
                  {je.notes && <ReadonlyField label="Notes" value={je.notes} full />}
                  {je.internalNotes && <ReadonlyField label="Internal Notes" value={je.internalNotes} full />}
                </div>
              </ModernSection>
            </>
          )}

          {activeTab === 'audit' && <JournalEntryAuditTab journalEntryId={id} />}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={false} />}

          <div className="h-6" />
        </div>

        {/* Right sidebar */}
        <SalesDetailSidebar label="Journal Entry Details">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => navigate(`/finance/journal-entries/${id}/edit`, { state: { initialTab: 'files' } })}
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
              >
                <Upload className="size-4 text-stone-400 shrink-0" />
                Upload file
              </button>
              {canEditHere && (
                <button
                  type="button"
                  onClick={() => navigate(`/finance/journal-entries/${id}/edit`)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit journal entry
                </button>
              )}
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Export as PDF"
              >
                {exportingPdf ? <Loader2 className="size-4 text-stone-400 shrink-0 animate-spin" /> : <FileDown className="size-4 text-stone-400 shrink-0" />}
                {exportingPdf ? 'Exporting…' : 'Export PDF'}
              </button>
            </div>
            {exportPdfError && (
              <p role="alert" className="text-2xs text-destructive">{exportPdfError}</p>
            )}
          </div>

          {(canApproveHere || canPostHere || canReverseHere) && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-2.5 mb-4">
              <p className="text-xs font-semibold text-stone-400">Actions</p>
              {canApproveHere && <ApproveJournalEntryDialog journalEntryId={id} onApproved={refresh} />}
              {canPostHere && <PostJournalEntryDialog journalEntryId={id} onPosted={refresh} />}
              {canReverseHere && <ReverseJournalEntryDialog journalEntryId={id} onReversed={refresh} />}
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={color}>{je.status}</Badge>
            </div>
            {je.postedAt && (
              <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
                <span className="text-stone-500">Posted</span>
                <span className="text-stone-700">{fmtDateTime(je.postedAt)}</span>
              </div>
            )}
            {je.reversedAt && (
              <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
                <span className="text-stone-500">Reversed</span>
                <span className="text-stone-700">{fmtDateTime(je.reversedAt)}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(je.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(je.updatedAt)}</span>
            </div>
          </div>

          {(canDeleteHere || canCancelHere) && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              {canCancelHere && (
                <CancelJournalEntryDialog journalEntryId={id} onCancelled={refresh} />
              )}
              {canDeleteHere && (
                <DeleteJournalEntryDialog
                  journalEntryId={id}
                  label={`Journal Entry ${je.number}`}
                  onDeleted={() => {
                    queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
                    navigate('/finance/journal-entries');
                  }}
                />
              )}
            </div>
          )}
        </SalesDetailSidebar>
      </div>
    </div>
  );
}

function ReadonlyField({ label, value, full }: { label: string; value?: string; full?: boolean }) {
  return (
    <div className={cn('space-y-1', full && 'col-span-full')}>
      <label className={fieldLabelCls}>{label}</label>
      <div className={readonlyCls}>{value || <span className="text-stone-400">—</span>}</div>
    </div>
  );
}
