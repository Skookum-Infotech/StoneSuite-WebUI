import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Landmark, Pencil, FileDown, Loader2, Plus } from 'lucide-react';
import { chartOfAccountsService } from '@/services/chartOfAccountsService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import { parseCoaError } from '@/lib/coaErrors';
import { attrFieldsFor, ACCOUNT_NUMBER_LAST4_KEY } from '@/lib/coaAttributes';
import {
  visibilityPayload, applicableVisibilityActions, VISIBILITY_ACTION_LABELS, type VisibilityAction,
} from '@/lib/coaVisibility';
import { ACCOUNT_TYPE_LABELS } from '@/types/chartOfAccounts';
import { AccountFormDrawer } from './components/AccountFormDrawer';
import { AccountHistoryTab } from './components/AccountHistoryTab';
import { BlockingSlotsDialog } from './components/BlockingSlotsDialog';
import { DeleteAccountDialog } from './components/DeleteAccountDialog';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'history', label: 'History' },
] as const;
type Tab = (typeof TABS)[number]['key'];

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AccountDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();
  const [blocked, setBlocked] = useState<{ message: string; slots: string[] } | null>(null);
  // The Status card's toggle buttons are conditional on account state, so a
  // successful toggle unmounts/remounts the clicked button and silently
  // drops keyboard focus to <body>. A persistent sr-only status region at
  // least announces the result to a screen-reader user.
  const [announcement, setAnnouncement] = useState('');

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canUpdate = permissionsLoading || hasPermission('chart_of_account', 'update');
  const canCreate = permissionsLoading || hasPermission('chart_of_account', 'create');
  const canDelete = permissionsLoading || hasPermission('chart_of_account', 'delete');

  const { data: account, isLoading, error } = useQuery({
    queryKey: ['coa-account', id],
    queryFn: () => chartOfAccountsService.getAccount(id),
    enabled: Boolean(id),
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (account) {
      setLabel(id, `${account.code} · ${account.name}`);
      return () => clearLabel(id);
    }
  }, [id, account, setLabel, clearLabel]);

  const toggle = useMutation({
    mutationFn: (action: VisibilityAction) => {
      if (!account) throw new Error('Account not loaded.');
      return chartOfAccountsService.updateAccount(account.id, {
        ...visibilityPayload(action),
        recordVersion: account.recordVersion,
      });
    },
    onSuccess: (_data, action) => {
      setAnnouncement(`${VISIBILITY_ACTION_LABELS[action]} applied.`);
      queryClient.invalidateQueries({ queryKey: ['coa-account', id] });
      queryClient.invalidateQueries({ queryKey: ['coa-tree'] });
      queryClient.invalidateQueries({ queryKey: ['coa-accounts'] });
    },
    onError: (err) => {
      const info = parseCoaError(err, 'Failed to update account.');
      if (info.kind === 'blockingSlots') setBlocked({ message: info.message, slots: info.blockingSlots ?? [] });
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading account…" /></div>;
  if (error || !account) {
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load account.')}</ErrorNote></div>;
  }

  const statusColor = account.isActive ? '#22c55e' : account.isVisible ? '#f59e0b' : '#6b7280';
  const statusLabel = account.isActive ? 'Active' : account.isVisible ? 'Inactive' : 'Hidden';
  const actions = applicableVisibilityActions(account);
  const attributeFields = attrFieldsFor(account.type).filter((f) => !f.writeOnly);
  const bankLast4 = account.attributes[ACCOUNT_NUMBER_LAST4_KEY];

  async function handleExportPdf() {
    if (!account) return;
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportFinanceRecordToPdf } = await import('@/lib/financePdfExport');
      await exportFinanceRecordToPdf({
        title: account.name,
        recordNumber: account.code,
        statusLabel,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        sections: [
          {
            title: 'Classification',
            rows: [
              ['Category', `${account.categoryCode} — ${account.categoryName}`],
              ['Sub-category', `${account.subCategoryCode} — ${account.subCategoryName}`],
              ['Balance Sheet / P&L', account.bsPnl === 'BS' ? 'Balance Sheet' : 'Profit & Loss'],
              ['Type', ACCOUNT_TYPE_LABELS[account.type]],
              ['Depth', account.depth === 0 ? 'Top-level account' : 'Sub-account'],
            ],
          },
          {
            title: 'Flags',
            rows: [
              ['Postable', account.isPostable ? 'Yes' : 'No'],
              ['Active', account.isActive ? 'Yes' : 'No'],
              ['Visible', account.isVisible ? 'Yes' : 'No'],
              ['System account', account.isSystem ? 'Yes' : 'No'],
            ],
          },
          {
            title: 'Attributes',
            rows: [
              ...attributeFields.map((f) => [f.label, account.attributes[f.key] || ''] as [string, string]),
              ...(bankLast4 ? [['Account Number', `•••• ${bankLast4}`] as [string, string]] : []),
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
        backLabel="Chart of Accounts"
        onBack={() => navigate('/finance/chart-of-accounts')}
        icon={Landmark}
        title={account.name}
        subtitle={ACCOUNT_TYPE_LABELS[account.type]}
        recordNumber={account.code}
        statusBadge={<Badge color={statusColor}>{statusLabel}</Badge>}
      />

      <div role="tablist" aria-label="Account detail" className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-12 4xl:px-16 modal-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`account-tab-${tab.key}`}
            aria-selected={activeTab === tab.key}
            aria-controls={`account-tabpanel-${tab.key}`}
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
        <div className="flex-1 space-y-3 min-w-0">
          {activeTab === 'overview' && (
            <div
              id="account-tabpanel-overview"
              role="tabpanel"
              aria-labelledby="account-tab-overview"
              className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3"
            >
              <OverviewRow label="Description" value={account.description || '—'} />
              <OverviewRow label="Category" value={`${account.categoryCode} — ${account.categoryName}`} />
              <OverviewRow label="Sub-category" value={`${account.subCategoryCode} — ${account.subCategoryName}`} />
              <OverviewRow label="Balance Sheet / P&L" value={account.bsPnl === 'BS' ? 'Balance Sheet' : 'Profit & Loss'} />
              <OverviewRow label="Depth" value={account.depth === 0 ? 'Top-level account' : 'Sub-account'} />
              {attributeFields.length > 0 && (
                <div className="border-t border-stone-100 pt-3 space-y-2">
                  <p className="text-2xs font-semibold uppercase tracking-wide text-stone-400">Attributes</p>
                  {attributeFields.map((f) => (
                    <OverviewRow key={f.key} label={f.label} value={account.attributes[f.key] || '—'} />
                  ))}
                  {bankLast4 && <OverviewRow label="Account Number" value={`•••• ${bankLast4}`} />}
                </div>
              )}
            </div>
          )}
          {activeTab === 'history' && (
            <div
              id="account-tabpanel-history"
              role="tabpanel"
              aria-labelledby="account-tab-history"
              className="rounded-xl border border-stone-200 bg-white shadow-sm p-2"
            >
              <AccountHistoryTab accountId={id} />
            </div>
          )}

          <div className="h-6" />
        </div>

        <div className="lg:w-72 lg:shrink-0 lg:sticky lg:top-[4.5rem] lg:h-fit lg:self-start">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              {canUpdate && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit account
                </button>
              )}
              {canCreate && account.depth === 0 && (
                <button
                  type="button"
                  onClick={() => setAddingChild(true)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Plus className="size-4 text-stone-400 shrink-0" />
                  Add sub-account
                </button>
              )}
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                aria-label="Export as PDF"
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {exportingPdf ? <Loader2 className="size-4 text-stone-400 shrink-0 animate-spin" /> : <FileDown className="size-4 text-stone-400 shrink-0" />}
                {exportingPdf ? 'Exporting…' : 'Export PDF'}
              </button>
            </div>
            {exportPdfError && <p role="alert" className="text-2xs text-destructive">{exportPdfError}</p>}
          </div>

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={statusColor}>{statusLabel}</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Postable</span>
              <span className="text-stone-700">{account.isPostable ? 'Yes' : 'No (header)'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(account.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(account.updatedAt)}</span>
            </div>
            {canUpdate && actions.length > 0 && (
              <div className="flex gap-2 pt-1">
                {actions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => toggle.mutate(action)}
                    disabled={toggle.isPending}
                    className="flex-1 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-2xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors"
                  >
                    {VISIBILITY_ACTION_LABELS[action]}
                  </button>
                ))}
              </div>
            )}
            <p role="status" className="sr-only">{announcement}</p>
          </div>

          {canDelete && !account.isSystem && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeleteAccountDialog
                accountId={id}
                label={`${account.code} ${account.name}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['coa-tree'] });
                  queryClient.invalidateQueries({ queryKey: ['coa-accounts'] });
                  navigate('/finance/chart-of-accounts');
                }}
              />
            </div>
          )}
        </div>
      </div>

      {editing && (
        <AccountFormDrawer account={account} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      )}
      {addingChild && (
        <AccountFormDrawer
          parent={{
            id: account.id, code: account.code, name: account.name,
            subCategoryId: account.subCategoryId, subCategoryCode: account.subCategoryCode,
            subCategoryName: account.subCategoryName,
          }}
          onClose={() => setAddingChild(false)}
          onSaved={() => setAddingChild(false)}
        />
      )}
      {blocked && (
        <BlockingSlotsDialog message={blocked.message} slots={blocked.slots} onClose={() => setBlocked(null)} />
      )}
    </div>
  );
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 text-xs">
      <span className="text-stone-500 shrink-0">{label}</span>
      <span className="text-stone-800 text-right break-words">{value}</span>
    </div>
  );
}
