import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Wallet, Upload, Pencil, FileDown, Loader2 } from 'lucide-react';
import { expenseService } from '@/services/expenseService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { FilesContent } from '@/components/crm/CrmSubTabsPanel';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import {
  EXPENSE_STATUS_COLORS, EXPENSE_DELETABLE_STATUSES, EXPENSE_ALLOWED_TRANSITIONS, canRejectExpense,
} from '@/lib/expenseForm';
import { ExpenseAuditTab } from './components/ExpenseAuditTab';
import { DeleteExpenseDialog } from './components/DeleteExpenseDialog';
import { ExpenseTransitionBar } from './components/ExpenseTransitionBar';
import { ExpenseApprovalButton } from './components/ExpenseApprovalButton';
import { RejectExpenseDialog } from './components/RejectExpenseDialog';
import { SalesDetailSidebar } from '@/pages/sales/components/SalesDetailSidebar';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'items', label: 'Items' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
type Tab = (typeof TABS)[number]['key'];

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function ExpenseDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('expense', 'update');
  const canDelete = permissionsLoading || hasPermission('expense', 'delete');
  const canTransition = permissionsLoading || hasPermission('expense', 'transition');

  const { data: exp, isLoading, error } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => expenseService.getExpense(id),
    enabled: Boolean(id),
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  // Never show a raw record UUID in the breadcrumb — swap in the expense
  // number once the record loads, and clear it on unmount.
  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (exp?.expenseNumber) {
      setLabel(id, exp.expenseNumber);
      return () => clearLabel(id);
    }
  }, [id, exp?.expenseNumber, setLabel, clearLabel]);

  const transition = useMutation({
    mutationFn: (toStatusCode: string) => expenseService.transition(id, toStatusCode),
    onSuccess: (updated) => {
      queryClient.setQueryData(['expense', id], updated);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading expense claim…" /></div>;
  // A 404 here can mean "exists but is out of your scope" as well as "no such
  // record", so the copy stays non-committal about whether it exists.
  if (error || !exp)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Expense claim not available.')}</ErrorNote></div>;

  const color = EXPENSE_STATUS_COLORS[exp.statusCode] ?? '#a8a29e';
  const canDeleteHere = canDelete && EXPENSE_DELETABLE_STATUSES.has(exp.statusCode);
  const claimantName = exp.claimantEmployeeId
    ? (lookups?.employees ?? []).find((e) => String(e.id) === String(exp.claimantEmployeeId))?.name
    : undefined;

  // The terminal status (REIM) has no legal transitions, and a user without
  // `expense:transition` sees none either — in both cases the bar renders
  // nothing, so the card would be an empty "Actions" header. Hide it unless it
  // has real content (a transition, an approval gate, a reject option, or a
  // failed transition).
  const hasTransitions = canTransition && (EXPENSE_ALLOWED_TRANSITIONS[exp.statusCode]?.length ?? 0) > 0;
  const isApprovalPending = exp.approvalStatus === 'pending';
  const canReject = canTransition && canRejectExpense(exp.statusCode);
  const showActions = hasTransitions || isApprovalPending || canReject || Boolean(transition.error);

  async function handleExportPdf() {
    if (!exp) return;
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportPurchasesRecordToPdf } = await import('@/lib/purchasesPdfExport');
      await exportPurchasesRecordToPdf({
        recordType: 'expense',
        title: exp.expenseNumber || 'Expense',
        recordNumber: exp.expenseNumber,
        statusLabel: exp.status,
        counterpartyLabel: 'Claimant',
        counterpartyName: claimantName,
        createdAt: exp.createdAt,
        updatedAt: exp.updatedAt,
        sections: [
          {
            title: 'Primary Information',
            rows: [
              ['Claimant', claimantName ?? ''],
              ['Department', exp.department || ''],
              ['Memo', exp.memo || ''],
              ...(exp.rejectionReason ? [['Rejection Reason', exp.rejectionReason] as [string, string]] : []),
            ],
          },
        ],
        itemsTable: {
          head: ['#', 'Category', 'Date', 'Description', 'Amount'],
          rows: exp.items.map((line) => [
            String(line.lineNumber),
            line.categoryName || line.categoryCode || '—',
            fmtDate(line.expenseDate),
            line.description || '—',
            currency(line.amount),
          ]),
          numericFrom: 4,
        },
        totals: [
          { label: 'Total', value: currency(exp.total), bold: true },
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
        backLabel="Expenses"
        onBack={() => navigate('/purchases/expense')}
        icon={Wallet}
        title={exp.expenseNumber || 'Expense'}
        subtitle={exp.department || undefined}
        recordNumber={exp.expenseNumber}
        statusBadge={<Badge color={color}>{exp.status}</Badge>}
      />

      {/* Tab bar */}
      <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-12 4xl:px-16 modal-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            aria-label={`${tab.label} tab`}
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
              <ModernSection title="Primary Information" index={0}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField label="Claimant" value={claimantName} />
                  <ReadonlyField label="Department" value={exp.department} />
                  {exp.memo && <ReadonlyField label="Memo" value={exp.memo} full />}
                  {exp.rejectionReason && (
                    <ReadonlyField label="Rejection Reason" value={exp.rejectionReason} full />
                  )}
                </div>
              </ModernSection>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <Total label="Total" value={exp.total} bold />
              </div>
            </>
          )}

          {activeTab === 'items' && (
            <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr className="divide-x divide-stone-200">
                    {[
                      { label: '#' },
                      { label: 'Category' },
                      { label: 'Date' },
                      { label: 'Description' },
                      { label: 'Amount', right: true },
                    ].map((h) => (
                      <th key={h.label} className={cn('px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap', h.right && 'text-right')}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {exp.items.map((line) => (
                    <tr key={line.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
                      <td className="px-3 py-2.5 text-stone-400 tabular-nums">{line.lineNumber}</td>
                      <td className="px-3 py-2.5 font-medium text-stone-800">
                        {line.categoryName || line.categoryCode || <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-stone-500 whitespace-nowrap">{fmtDate(line.expenseDate)}</td>
                      <td className="px-3 py-2.5 text-stone-500 max-w-[220px] truncate">{line.description || '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-800 font-semibold">{currency(line.amount)}</td>
                    </tr>
                  ))}
                  {exp.items.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-stone-400">No expense lines.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'audit' && <ExpenseAuditTab expenseId={id} />}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={false} />}

          <div className="h-6" />
        </div>

        {/* Right sidebar */}
        <SalesDetailSidebar label="Expense Details">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => navigate(`/purchases/expense/${id}/edit`, { state: { initialTab: 'files' } })}
                aria-label="Upload a file to this expense claim"
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
              >
                <Upload className="size-4 text-stone-400 shrink-0" />
                Upload file
              </button>
              {canEdit && exp.statusCode === 'DRFT' && (
                <button
                  type="button"
                  onClick={() => navigate(`/purchases/expense/${id}/edit`)}
                  aria-label="Edit this expense claim"
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit expense
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

          {showActions && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-stone-400">Actions</p>
              <ExpenseTransitionBar
                statusCode={exp.statusCode}
                approvalStatus={exp.approvalStatus}
                onTransition={(toCode) => transition.mutate(toCode)}
                isPending={transition.isPending}
              />
              {isApprovalPending && (
                <ExpenseApprovalButton
                  expenseId={id}
                  onApproved={(updated) => {
                    queryClient.setQueryData(['expense', id], updated);
                    queryClient.invalidateQueries({ queryKey: ['expenses'] });
                  }}
                />
              )}
              {canReject && (
                <RejectExpenseDialog
                  expenseId={id}
                  onRejected={(updated) => {
                    queryClient.setQueryData(['expense', id], updated);
                    queryClient.invalidateQueries({ queryKey: ['expenses'] });
                  }}
                />
              )}
              {transition.error && (
                <p role="alert" className="text-2xs text-destructive">{apiErrorMessage(transition.error, 'Failed to change status.')}</p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={color}>{exp.status}</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(exp.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(exp.updatedAt)}</span>
            </div>
          </div>

          {canDeleteHere && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeleteExpenseDialog
                expenseId={id}
                label={`Expense ${exp.expenseNumber}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['expenses'] });
                  navigate('/purchases/expense');
                }}
              />
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

function Total({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className={cn('tabular-nums', bold ? 'text-sm font-bold text-stone-900' : 'text-xs font-semibold text-stone-600')}>
        {currency(value)}
      </p>
    </div>
  );
}
