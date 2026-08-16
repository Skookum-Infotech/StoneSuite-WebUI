import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { FilePlus, Upload, Pencil, FileDown, Loader2 } from 'lucide-react';
import { vendorCreditService } from '@/services/vendorCreditService';
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
import { VC_STATUS_COLORS, VC_EDITABLE_STATUSES, VC_ALLOWED_TRANSITIONS } from '@/lib/vendorCreditForm';
import { VendorCreditAuditTab } from './components/VendorCreditAuditTab';
import { VendorCreditApplicationsTab } from './components/VendorCreditApplicationsTab';
import { VendorCreditTransitionBar } from './components/VendorCreditTransitionBar';
import { DeleteVendorCreditDialog } from './components/DeleteVendorCreditDialog';
import type { VendorCredit } from '@/types/vendorCredit';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'applications', label: 'Applications' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
type Tab = (typeof TABS)[number]['key'];

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function VendorCreditDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('vendor_credit', 'update');
  const canDelete = permissionsLoading || hasPermission('vendor_credit', 'delete');

  const { data: credit, isLoading, error } = useQuery({
    queryKey: ['vendor-credit', id],
    queryFn: () => vendorCreditService.getVendorCredit(id),
    enabled: Boolean(id),
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (credit?.vendorCreditNumber) {
      setLabel(id, credit.vendorCreditNumber);
      return () => clearLabel(id);
    }
  }, [id, credit?.vendorCreditNumber, setLabel, clearLabel]);

  // Every mutation on this page (transition/apply/reverse) returns the full
  // updated credit, so the cache is re-seeded from the response instead of
  // refetching. Applying also moves a vendor bill's balance, hence the
  // vendor-bill invalidations.
  function absorb(updated: VendorCredit) {
    queryClient.setQueryData(['vendor-credit', id], updated);
    queryClient.invalidateQueries({ queryKey: ['vendor-credits'] });
    queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
    queryClient.invalidateQueries({ queryKey: ['vendor-bill'] });
  }

  const transition = useMutation({
    mutationFn: (toStatusCode: string) => vendorCreditService.transition(id, toStatusCode),
    onSuccess: absorb,
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading vendor credit…" /></div>;
  if (error || !credit)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load vendor credit.')}</ErrorNote></div>;

  const color = VC_STATUS_COLORS[credit.statusCode] ?? '#a8a29e';
  // The backend refuses a delete while any live application references the
  // credit (409) — reverse it first.
  const canDeleteHere = canDelete && credit.applications.length === 0;
  const hasTransitions = (VC_ALLOWED_TRANSITIONS[credit.statusCode]?.length ?? 0) > 0;
  const showActions = hasTransitions || Boolean(transition.error);
  const canEditHere = canEdit && VC_EDITABLE_STATUSES.has(credit.statusCode);

  async function handleExportPdf() {
    if (!credit) return;
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportPurchasesRecordToPdf } = await import('@/lib/purchasesPdfExport');
      await exportPurchasesRecordToPdf({
        recordType: 'vendor_credit',
        title: credit.vendorCreditNumber || 'Vendor Credit',
        recordNumber: credit.vendorCreditNumber,
        statusLabel: credit.status,
        counterpartyName: credit.vendor.name,
        createdAt: credit.createdAt,
        updatedAt: credit.updatedAt,
        sections: [
          {
            title: 'Primary Information',
            rows: [
              ['Reference #', credit.referenceNumber || ''],
              ['Credit Date', fmtDate(credit.creditDate)],
              ['Reason', credit.reason || ''],
              ['Memo', credit.memo || ''],
              ['Internal Notes', credit.internalNotes || ''],
            ],
          },
        ],
        itemsTable: {
          title: 'Applications',
          head: ['Vendor Bill #', 'Amount', 'Applied On'],
          rows: credit.applications.map((app) => [
            app.vendorBillNumber || '—',
            currency(app.amount),
            fmtDate(app.createdAt),
          ]),
          numericFrom: 1,
        },
        totals: [
          { label: 'Amount', value: currency(credit.grandTotal), bold: true },
          { label: 'Applied', value: currency(credit.appliedTotal) },
          { label: 'Unapplied', value: currency(credit.unappliedAmount), bold: true },
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
        backLabel="Vendor Credits"
        onBack={() => navigate('/purchases/vendor_credit')}
        icon={FilePlus}
        title={credit.vendorCreditNumber || 'Vendor Credit'}
        subtitle={credit.vendor.name}
        recordNumber={credit.vendorCreditNumber}
        statusBadge={<Badge color={color}>{credit.status}</Badge>}
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
              <ModernSection title="Primary Information" index={0}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField label="Reference #" value={credit.referenceNumber} />
                  <ReadonlyField label="Credit Date" value={fmtDate(credit.creditDate)} />
                  <ReadonlyField label="Reason" value={credit.reason} />
                  {credit.memo && <ReadonlyField label="Memo" value={credit.memo} full />}
                  {credit.internalNotes && <ReadonlyField label="Internal Notes" value={credit.internalNotes} full />}
                </div>
              </ModernSection>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="grid grid-cols-3 gap-3">
                  <Total label="Amount" value={credit.grandTotal} bold />
                  <Total label="Applied" value={credit.appliedTotal} />
                  <Total label="Unapplied" value={credit.unappliedAmount} bold />
                </div>
              </div>
            </>
          )}

          {activeTab === 'applications' && (
            <VendorCreditApplicationsTab credit={credit} canEdit={canEdit} onChanged={absorb} />
          )}
          {activeTab === 'audit' && <VendorCreditAuditTab vendorCreditId={id} />}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={false} />}

          <div className="h-6" />
        </div>

        {/* Right sidebar */}
        <SalesDetailSidebar label="Vendor Credit Details">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => navigate(`/purchases/vendor_credit/${id}/edit`, { state: { initialTab: 'files' } })}
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
              >
                <Upload className="size-4 text-stone-400 shrink-0" />
                Upload file
              </button>
              {canEditHere && (
                <button
                  type="button"
                  onClick={() => navigate(`/purchases/vendor_credit/${id}/edit`)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit vendor credit
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
              <VendorCreditTransitionBar
                statusCode={credit.statusCode}
                onTransition={(toCode) => transition.mutate(toCode)}
                isPending={transition.isPending}
              />
              {transition.error && (
                <p role="alert" className="text-2xs text-destructive">
                  {apiErrorMessage(transition.error, 'Failed to change status.')}
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={color}>{credit.status}</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Vendor</span>
              <button
                type="button"
                onClick={() => navigate(`/purchases/vendor/${credit.vendor.id}`)}
                className="text-stone-700 hover:text-accent-foreground truncate max-w-[140px] transition-colors"
              >
                {credit.vendor.name}
              </button>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(credit.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(credit.updatedAt)}</span>
            </div>
          </div>

          {canDeleteHere && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeleteVendorCreditDialog
                vendorCreditId={id}
                label={`Vendor Credit ${credit.vendorCreditNumber}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['vendor-credits'] });
                  navigate('/purchases/vendor_credit');
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
