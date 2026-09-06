import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ClipboardList, Upload, Pencil, ArrowRightLeft, FileDown, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { requisitionService } from '@/services/requisitionService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { FilesContent } from '@/components/crm/CrmSubTabsPanel';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { ApprovalBanner } from '@/components/tenant/ApprovalBanner';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import {
  REQUISITION_STATUS_COLORS, REQUISITION_STATUS_CODES, REQN_DELETABLE_STATUSES, REQUISITION_ALLOWED_TRANSITIONS,
  PRIORITY_COLORS, priorityLabel, canConvertToPurchaseOrder,
} from '@/lib/requisitionForm';
import { statusToastLabel } from '@/lib/statusToast';
import { RequisitionAuditTab } from './components/RequisitionAuditTab';
import { DeleteRequisitionDialog } from './components/DeleteRequisitionDialog';
import { RequisitionStatusControl } from './components/RequisitionStatusControl';
import { ConvertToPurchaseOrderDialog } from './components/ConvertToPurchaseOrderDialog';
import { SalesDetailSidebar } from '@/pages/sales/components/SalesDetailSidebar';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'items', label: 'Items' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
type Tab = (typeof TABS)[number]['key'];

// Poll the primary record so status/approval changes made by another user or
// tab show up without a manual reload — same cadence as NotificationBell's
// unread poll.
const DETAIL_POLL_MS = 60_000;

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function RequisitionDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [convertOpen, setConvertOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('requisition', 'update');
  const canDelete = permissionsLoading || hasPermission('requisition', 'delete');
  const canTransition = permissionsLoading || hasPermission('requisition', 'transition');
  // Converting spawns a purchase order, so the server checks
  // purchase_order:create on top of requisition:read — mirror that here rather
  // than offering an action that would 403.
  const canCreatePo = permissionsLoading || hasPermission('purchase_order', 'create');

  const { data: reqn, isLoading, error } = useQuery({
    queryKey: ['requisition', id],
    queryFn: () => requisitionService.getRequisition(id),
    enabled: Boolean(id),
    refetchInterval: DETAIL_POLL_MS,
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  // Never show a raw record UUID in the breadcrumb — swap in the requisition
  // number once the record loads, and clear it on unmount.
  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (reqn?.requisitionNumber) {
      setLabel(id, reqn.requisitionNumber);
      return () => clearLabel(id);
    }
  }, [id, reqn?.requisitionNumber, setLabel, clearLabel]);

  const transition = useMutation({
    mutationFn: (toStatusCode: string) => requisitionService.transition(id, toStatusCode),
    onSuccess: (updated, toStatusCode) => {
      queryClient.setQueryData(['requisition', id], updated);
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      toast.success(`Moved to ${statusToastLabel(REQUISITION_STATUS_CODES, toStatusCode)}.`);
    },
  });

  const approve = useMutation({
    mutationFn: () => requisitionService.approve(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(['requisition', id], updated);
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      toast.success('Approved.');
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading requisition…" /></div>;
  // A 404 here can mean "exists but is out of your scope" as well as "no such
  // record", so the copy stays non-committal about whether it exists.
  if (!reqn)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Requisition not available.')}</ErrorNote></div>;

  const color = REQUISITION_STATUS_COLORS[reqn.statusCode] ?? '#a8a29e';
  const priorityColor = PRIORITY_COLORS[reqn.priority] ?? '#a8a29e';
  // Bound once so the narrowing survives into the click handler below.
  const suggestedVendor = reqn.vendor;
  const canDeleteHere = canDelete && REQN_DELETABLE_STATUSES.has(reqn.statusCode);
  const requesterName = reqn.requestedByEmployeeId
    ? (lookups?.employees ?? []).find((e) => String(e.id) === String(reqn.requestedByEmployeeId))?.name
    : undefined;

  // The terminal status (CANC) has no legal transitions, and a user without
  // `requisition:transition` sees none either — in both cases the bar renders
  // nothing, so the card would be an empty "Actions" header. Hide it unless it
  // has real content (a transition, an approval gate, or a failed transition).
  const hasTransitions = canTransition && (REQUISITION_ALLOWED_TRANSITIONS[reqn.statusCode]?.length ?? 0) > 0;
  const showActions = hasTransitions || Boolean(transition.error);
  const showConvert = canCreatePo && canConvertToPurchaseOrder(reqn.statusCode, reqn.convertedPurchaseOrderId);

  async function handleExportPdf() {
    if (!reqn) return;
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportPurchasesRecordToPdf } = await import('@/lib/purchasesPdfExport');
      await exportPurchasesRecordToPdf({
        recordType: 'requisition',
        title: reqn.requisitionNumber || 'Requisition',
        recordNumber: reqn.requisitionNumber,
        statusLabel: reqn.status,
        counterpartyLabel: 'Suggested Vendor',
        counterpartyName: reqn.vendor?.name,
        createdAt: reqn.createdAt,
        updatedAt: reqn.updatedAt,
        sections: [
          {
            title: 'Primary Information',
            rows: [
              ['Requested By', requesterName ?? ''],
              ['Department', reqn.department || ''],
              ['Needed By', reqn.neededByDate ? fmtDate(reqn.neededByDate) : ''],
              ['Priority', priorityLabel(reqn.priority)],
              ['Sales Tax %', `${reqn.salesTaxPercent}%`],
              ['Memo', reqn.memo || ''],
            ],
          },
        ],
        itemsTable: {
          head: ['#', 'Item', 'SKU', 'Qty', 'Est. Unit Price', 'Amount'],
          rows: reqn.items.map((line) => [
            String(line.lineNumber),
            line.itemName || line.description || '—',
            line.sku || '—',
            String(line.quantity),
            currency(line.estimatedUnitPrice),
            currency(line.estimatedAmount),
          ]),
          numericFrom: 3,
        },
        totals: [
          { label: 'Subtotal', value: currency(reqn.subtotal) },
          { label: 'Tax', value: currency(reqn.taxTotal) },
          { label: 'Estimated Total', value: currency(reqn.estimatedTotal), bold: true },
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
        backLabel="Requisitions"
        onBack={() => navigate('/purchases/requisition')}
        icon={ClipboardList}
        title={reqn.requisitionNumber || 'Requisition'}
        subtitle={reqn.department || undefined}
        recordNumber={reqn.requisitionNumber}
        statusBadge={<Badge color={color}>{reqn.status}</Badge>}
      />

      {reqn.gated && (
        <>
          <ApprovalBanner
            approverNames={reqn.approvers.filter((a) => !a.approved).map((a) => a.name)}
            canApprove={reqn.canApprove}
            isOverride={reqn.isOverride}
            requiredApprovals={reqn.requiredApprovals}
            approvedCount={reqn.approvedCount}
            callerAlreadyApproved={reqn.callerAlreadyApproved}
            onApprove={() => approve.mutate()}
            approving={approve.isPending}
          />
          {approve.isError && (
            <p role="alert" className="px-5 py-1.5 text-2xs text-destructive 3xl:px-12 4xl:px-16">
              {apiErrorMessage(approve.error, 'Failed to approve requisition.')}
            </p>
          )}
        </>
      )}

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
                  <ReadonlyField label="Requested By" value={requesterName} />
                  <ReadonlyField label="Department" value={reqn.department} />
                  <ReadonlyField label="Needed By" value={reqn.neededByDate ? fmtDate(reqn.neededByDate) : undefined} />
                  <ReadonlyField label="Priority" value={priorityLabel(reqn.priority)} />
                  <ReadonlyField label="Suggested Vendor" value={reqn.vendor?.name} />
                  <ReadonlyField label="Sales Tax %" value={`${reqn.salesTaxPercent}%`} />
                  {reqn.memo && <ReadonlyField label="Memo" value={reqn.memo} full />}
                </div>
              </ModernSection>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Total label="Subtotal" value={reqn.subtotal} />
                  <Total label="Tax" value={reqn.taxTotal} />
                  <Total label="Estimated Total" value={reqn.estimatedTotal} bold />
                </div>
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
                      { label: 'Item' },
                      { label: 'Description' },
                      { label: 'SKU' },
                      { label: 'Units' },
                      { label: 'Qty', right: true },
                      { label: 'Est. Unit Price', right: true },
                      { label: 'Amount', right: true },
                    ].map((h) => (
                      <th key={h.label} className={cn('px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap', h.right && 'text-right')}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {reqn.items.map((line) => (
                    <tr key={line.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
                      <td className="px-3 py-2.5 text-stone-400 tabular-nums">{line.lineNumber}</td>
                      <td className="px-3 py-2.5 font-medium text-stone-800">
                        {line.itemName || line.description || <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-stone-500 max-w-[200px] truncate">{line.description || '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-2xs text-stone-500">{line.sku || '—'}</td>
                      <td className="px-3 py-2.5 text-stone-500">{line.unitCode || '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-600">{line.quantity}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-600">{currency(line.estimatedUnitPrice)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-800 font-semibold">{currency(line.estimatedAmount)}</td>
                    </tr>
                  ))}
                  {reqn.items.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-stone-400">No line items.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'audit' && <RequisitionAuditTab requisitionId={id} />}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={false} />}

          <div className="h-6" />
        </div>

        {/* Right sidebar */}
        <SalesDetailSidebar label="Requisition Details">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => navigate(`/purchases/requisition/${id}/edit`, { state: { initialTab: 'files' } })}
                aria-label="Upload a file to this requisition"
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
              >
                <Upload className="size-4 text-stone-400 shrink-0" />
                Upload file
              </button>
              {showConvert && (
                <button
                  type="button"
                  onClick={() => setConvertOpen(true)}
                  aria-label="Convert this requisition to a purchase order"
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <ArrowRightLeft className="size-4 text-stone-400 shrink-0" />
                  Convert to Purchase Order
                </button>
              )}
              {canEdit && reqn.statusCode === 'DRFT' && (
                <button
                  type="button"
                  onClick={() => navigate(`/purchases/requisition/${id}/edit`)}
                  aria-label="Edit this requisition"
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit requisition
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
              <RequisitionStatusControl
                order={{ statusCode: reqn.statusCode, approvalStatus: reqn.approvalStatus, gated: reqn.gated }}
                onChange={(toCode) => transition.mutate(toCode)}
                disabled={transition.isPending}
                variant="pill"
              />
              {transition.error && (
                <p role="alert" className="text-2xs text-destructive">{apiErrorMessage(transition.error, 'Failed to change status.')}</p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={color}>{reqn.status}</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Priority</span>
              <Badge color={priorityColor}>{priorityLabel(reqn.priority)}</Badge>
            </div>
            {suggestedVendor && (
              <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
                <span className="text-stone-500">Suggested Vendor</span>
                <button
                  type="button"
                  onClick={() => navigate(`/purchases/vendor/${suggestedVendor.id}`)}
                  aria-label={`Open vendor ${suggestedVendor.name}`}
                  className="text-stone-700 hover:text-accent-foreground truncate max-w-[140px] transition-colors"
                >
                  {suggestedVendor.name}
                </button>
              </div>
            )}
            {reqn.convertedPurchaseOrderId && (
              <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
                <span className="text-stone-500">Purchase Order</span>
                <button
                  type="button"
                  onClick={() => navigate(`/purchases/purchase_order/${reqn.convertedPurchaseOrderId}`)}
                  aria-label="Open the purchase order this requisition became"
                  className="inline-flex items-center gap-1 text-stone-700 hover:text-accent-foreground transition-colors"
                >
                  View
                  <ExternalLink className="size-3" />
                </button>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(reqn.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(reqn.updatedAt)}</span>
            </div>
          </div>

          {canDeleteHere && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeleteRequisitionDialog
                requisitionId={id}
                label={`Requisition ${reqn.requisitionNumber}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['requisitions'] });
                  navigate('/purchases/requisition');
                }}
              />
            </div>
          )}
        </SalesDetailSidebar>
      </div>

      {convertOpen && (
        <ConvertToPurchaseOrderDialog
          requisitionId={id}
          requisitionNumber={reqn.requisitionNumber}
          suggestedVendor={reqn.vendor}
          onClose={() => setConvertOpen(false)}
          onConverted={(result) => {
            setConvertOpen(false);
            // Both a fresh conversion and an idempotent replay (created:false)
            // land on the purchase order — the requisition is refetched so its
            // convertedPurchaseOrderId link appears if the user comes back.
            queryClient.invalidateQueries({ queryKey: ['requisition', id] });
            queryClient.invalidateQueries({ queryKey: ['requisitions'] });
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
            navigate(`/purchases/purchase_order/${result.purchaseOrderId}`);
          }}
        />
      )}
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
