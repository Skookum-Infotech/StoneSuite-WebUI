import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { FileSpreadsheet, Upload, Pencil, ArrowRightLeft, Loader2 } from 'lucide-react';
import { estimateService } from '@/services/estimateService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { FilesContent } from '@/components/crm/CrmSubTabsPanel';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import { ESTIMATE_STATUS_COLORS, ESTIMATE_CONVERTIBLE_STATUSES } from '@/lib/estimateForm';
import { EstimateAuditTab } from './components/EstimateAuditTab';
import { DeleteEstimateDialog } from './components/DeleteEstimateDialog';

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

export default function EstimateDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('estimate', 'update');
  const canDelete = permissionsLoading || hasPermission('estimate', 'delete');
  // Convert targets a new Quote, so gate on the Quote module's create
  // permission (backend checks source estimate:read + target quote:create).
  const canConvert = permissionsLoading || hasPermission('quote', 'create');

  const { data: estimate, isLoading, error } = useQuery({
    queryKey: ['estimate', id],
    queryFn: () => estimateService.getEstimate(id),
    enabled: Boolean(id),
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (estimate?.estimateNumber) {
      setLabel(id, estimate.estimateNumber);
      return () => clearLabel(id);
    }
  }, [id, estimate?.estimateNumber, setLabel, clearLabel]);

  // created: false just means a Quote already exists for this estimate
  // (idempotent replay) — either way, navigate to it.
  const convert = useMutation({
    mutationFn: () => estimateService.convertToQuote(id),
    onSuccess: ({ quote }) => navigate(`/sales/quote/${quote.id}`),
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading estimate…" /></div>;
  if (error || !estimate)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load estimate.')}</ErrorNote></div>;

  const color = ESTIMATE_STATUS_COLORS[estimate.status] ?? '#a8a29e';

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Estimates"
        onBack={() => navigate('/sales/estimate')}
        icon={FileSpreadsheet}
        title={estimate.estimateNumber || 'Estimate'}
        subtitle={estimate.customer.name}
        recordNumber={estimate.estimateNumber}
        statusBadge={<Badge color={color}>{estimate.status}</Badge>}
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
                  <ReadonlyField label="Estimate Date" value={fmtDate(estimate.estimateDate)} />
                  <ReadonlyField label="Valid Until" value={estimate.validUntil ? fmtDate(estimate.validUntil) : undefined} />
                  <ReadonlyField label="PO Number" value={estimate.poNumber} />
                  <ReadonlyField label="Reference #" value={estimate.referenceNumber} />
                  <ReadonlyField label="Sales Tax %" value={`${estimate.salesTaxPercent}%`} />
                  {estimate.memo && <ReadonlyField label="Memo" value={estimate.memo} full />}
                </div>
              </ModernSection>
              <ModernSection title="Bill To" index={1}>
                <AddressBlock addr={estimate.billing} />
              </ModernSection>
              <ModernSection title="Ship To" index={2}>
                {estimate.shipSameAsBilling ? (
                  <p className="text-xs text-stone-400 italic">Same as billing customer.</p>
                ) : (
                  <AddressBlock addr={estimate.shipping} />
                )}
              </ModernSection>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Total label="Subtotal" value={estimate.subtotal} />
                  <Total label="Discount" value={estimate.discountTotal} />
                  <Total label="Tax" value={estimate.taxTotal} />
                  <Total label="Grand Total" value={estimate.grandTotal} bold />
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
                      { label: 'Qty', right: true },
                      { label: 'Unit Price', right: true },
                      { label: 'Disc %', right: true },
                      { label: 'Tax %', right: true },
                      { label: 'Total', right: true },
                    ].map((h) => (
                      <th key={h.label} className={cn('px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap', h.right && 'text-right')}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {estimate.items.map((line) => (
                    <tr key={line.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
                      <td className="px-3 py-2.5 text-stone-400 tabular-nums">{line.lineNumber}</td>
                      <td className="px-3 py-2.5 font-medium text-stone-800">
                        {line.itemName || line.description || <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-stone-500 max-w-[200px] truncate">{line.description || '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-2xs text-stone-500">{line.sku || '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-600">{line.quantity}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-600">{currency(line.unitPrice)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-500">{line.discountPercent}%</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-500">{line.taxPercent}%</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-800 font-semibold">{currency(line.lineTotal)}</td>
                    </tr>
                  ))}
                  {estimate.items.length === 0 && (
                    <tr><td colSpan={9} className="py-8 text-center text-stone-400">No line items.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'audit' && <EstimateAuditTab estimateId={id} />}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={false} />}

          <div className="h-6" />
        </div>

        {/* Right sidebar */}
        <div className="lg:w-72 lg:shrink-0 lg:sticky lg:top-[4.5rem] lg:h-fit lg:self-start">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => navigate(`/sales/estimate/${id}/edit`, { state: { initialTab: 'files' } })}
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
              >
                <Upload className="size-4 text-stone-400 shrink-0" />
                Upload file
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`/sales/estimate/${id}/edit`)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit estimate
                </button>
              )}
              {canConvert && ESTIMATE_CONVERTIBLE_STATUSES.has(estimate.statusCode) && (
                <button
                  type="button"
                  onClick={() => convert.mutate()}
                  disabled={convert.isPending}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left disabled:opacity-50"
                >
                  {convert.isPending ? <Loader2 className="size-4 text-stone-400 shrink-0 animate-spin" /> : <ArrowRightLeft className="size-4 text-stone-400 shrink-0" />}
                  Convert to Quote
                </button>
              )}
            </div>
            {convert.isError && (
              <p role="alert" className="text-2xs text-destructive">{apiErrorMessage(convert.error, 'Failed to convert estimate.')}</p>
            )}
          </div>

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={color}>{estimate.status}</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Customer</span>
              <span className="text-stone-700 truncate max-w-[140px]">{estimate.customer.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(estimate.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(estimate.updatedAt)}</span>
            </div>
          </div>

          {canDelete && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeleteEstimateDialog
                estimateId={id}
                label={`Estimate ${estimate.estimateNumber}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['estimates'] });
                  navigate('/sales/estimate');
                }}
              />
            </div>
          )}
        </div>
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

function AddressBlock({ addr }: { addr: { customerName?: string; attention?: string; addrLine1?: string; addrLine2?: string; suiteUnit?: string; city?: string; zip?: string; phone?: string; fax?: string; email?: string } }) {
  const lines = [
    addr.attention,
    [addr.addrLine1, addr.addrLine2].filter(Boolean).join(', '),
    [addr.suiteUnit, addr.city, addr.zip].filter(Boolean).join(', '),
    addr.phone && `Phone: ${addr.phone}`,
    addr.email && `Email: ${addr.email}`,
  ].filter(Boolean);

  if (lines.length === 0) {
    return <p className="text-xs text-stone-400 italic">No address on file.</p>;
  }
  return (
    <div className="space-y-1 text-xs text-stone-700">
      {addr.customerName && <p className="font-semibold text-stone-900">{addr.customerName}</p>}
      {lines.map((line, i) => <p key={i} className="text-stone-600">{line}</p>)}
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
