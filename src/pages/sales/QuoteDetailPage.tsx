import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { FileText, Upload, Pencil, FileSpreadsheet, ArrowRightLeft, Loader2, FileDown } from 'lucide-react';
import { quoteService } from '@/services/quoteService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { FilesContent } from '@/components/crm/CrmSubTabsPanel';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import { QUOTE_STATUS_COLORS, QUOTE_CONVERTIBLE_STATUSES } from '@/lib/quoteForm';
import { QuoteAuditTab } from './components/QuoteAuditTab';
import { DeleteQuoteDialog } from './components/DeleteQuoteDialog';
import { SalesDetailSidebar } from './components/SalesDetailSidebar';

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

export default function QuoteDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('quote', 'update');
  const canDelete = permissionsLoading || hasPermission('quote', 'delete');
  // Convert targets a new Sales Order, so gate on the Sales Order module's
  // create permission (backend checks source quote:read + target sales_order:create).
  const canConvert = permissionsLoading || hasPermission('sales_order', 'create');

  const { data: quote, isLoading, error } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => quoteService.getQuote(id),
    enabled: Boolean(id),
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (quote?.quoteNumber) {
      setLabel(id, quote.quoteNumber);
      return () => clearLabel(id);
    }
  }, [id, quote?.quoteNumber, setLabel, clearLabel]);

  // created: false just means a Sales Order already exists for this quote
  // (idempotent replay) — either way, navigate to it.
  const convert = useMutation({
    mutationFn: () => quoteService.convertToSalesOrder(id),
    onSuccess: ({ salesOrder }) => navigate(`/sales/sales_order/${salesOrder.id}`),
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading quote…" /></div>;
  if (error || !quote)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load quote.')}</ErrorNote></div>;

  const color = QUOTE_STATUS_COLORS[quote.status] ?? '#a8a29e';

  async function handleExportPdf() {
    if (!quote) return;
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportSalesDocToPdf } = await import('@/lib/salesPdfExport');
      await exportSalesDocToPdf({
        docType: 'quote',
        title: quote.quoteNumber || 'Quote',
        recordNumber: quote.quoteNumber,
        statusLabel: quote.status,
        customerName: quote.customer.name,
        createdAt: quote.createdAt,
        updatedAt: quote.updatedAt,
        sections: [
          {
            title: 'Primary Information',
            rows: [
              ['Quote Date', fmtDate(quote.quoteDate)],
              ['Valid Until', quote.validUntil ? fmtDate(quote.validUntil) : ''],
              ['PO Number', quote.poNumber || ''],
              ['Reference #', quote.referenceNumber || ''],
              ['Sales Tax %', `${quote.salesTaxPercent}%`],
              ['Source Estimate', quote.estimate?.number || ''],
              ['Memo', quote.memo || ''],
            ],
          },
          { title: 'Bill To', rows: addressRows(quote.billing) },
          { title: 'Ship To', rows: quote.shipSameAsBilling ? [] : addressRows(quote.shipping) },
        ],
        itemsTable: {
          head: ['#', 'Item', 'Description', 'SKU', 'Qty', 'Unit Price', 'Disc %', 'Tax %', 'Total'],
          rows: quote.items.map((line) => [
            String(line.lineNumber),
            line.itemName || line.description || '—',
            line.description || '—',
            line.sku || '—',
            String(line.quantity),
            currency(line.unitPrice),
            `${line.discountPercent}%`,
            `${line.taxPercent}%`,
            currency(line.lineTotal),
          ]),
          numericFrom: 4,
        },
        totals: [
          { label: 'Subtotal', value: currency(quote.subtotal) },
          { label: 'Discount', value: currency(quote.discountTotal) },
          { label: 'Tax', value: currency(quote.taxTotal) },
          { label: 'Grand Total', value: currency(quote.grandTotal), bold: true },
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
        backLabel="Quotes"
        onBack={() => navigate('/sales/quote')}
        icon={FileText}
        title={quote.quoteNumber || 'Quote'}
        subtitle={quote.customer.name}
        recordNumber={quote.quoteNumber}
        statusBadge={<Badge color={color}>{quote.status}</Badge>}
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
                  <ReadonlyField label="Quote Date" value={fmtDate(quote.quoteDate)} />
                  <ReadonlyField label="Valid Until" value={quote.validUntil ? fmtDate(quote.validUntil) : undefined} />
                  <ReadonlyField label="PO Number" value={quote.poNumber} />
                  <ReadonlyField label="Reference #" value={quote.referenceNumber} />
                  <ReadonlyField label="Sales Tax %" value={`${quote.salesTaxPercent}%`} />
                  {quote.estimate && (
                    <div className="space-y-1">
                      <label className={fieldLabelCls}>Source Estimate</label>
                      <Link
                        to={`/sales/estimate/${quote.estimate.id}`}
                        className="inline-flex items-center gap-1.5 rounded-[10px] border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-xs font-semibold text-accent-foreground hover:bg-stone-100 transition-colors"
                      >
                        <FileSpreadsheet className="size-3.5" />
                        {quote.estimate.number}
                      </Link>
                    </div>
                  )}
                  {quote.memo && <ReadonlyField label="Memo" value={quote.memo} full />}
                </div>
              </ModernSection>
              <ModernSection title="Bill To" index={1}>
                <AddressBlock addr={quote.billing} />
              </ModernSection>
              <ModernSection title="Ship To" index={2}>
                {quote.shipSameAsBilling ? (
                  <p className="text-xs text-stone-400 italic">Same as billing customer.</p>
                ) : (
                  <AddressBlock addr={quote.shipping} />
                )}
              </ModernSection>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Total label="Subtotal" value={quote.subtotal} />
                  <Total label="Discount" value={quote.discountTotal} />
                  <Total label="Tax" value={quote.taxTotal} />
                  <Total label="Grand Total" value={quote.grandTotal} bold />
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
                  {quote.items.map((line) => (
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
                  {quote.items.length === 0 && (
                    <tr><td colSpan={9} className="py-8 text-center text-stone-400">No line items.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'audit' && <QuoteAuditTab quoteId={id} />}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={false} />}

          <div className="h-6" />
        </div>

        {/* Right sidebar */}
        <SalesDetailSidebar label="Quote Details">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => navigate(`/sales/quote/${id}/edit`, { state: { initialTab: 'files' } })}
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
              >
                <Upload className="size-4 text-stone-400 shrink-0" />
                Upload file
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`/sales/quote/${id}/edit`)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit quote
                </button>
              )}
              {canConvert && QUOTE_CONVERTIBLE_STATUSES.has(quote.statusCode) && (
                <button
                  type="button"
                  onClick={() => convert.mutate()}
                  disabled={convert.isPending}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left disabled:opacity-50"
                >
                  {convert.isPending ? <Loader2 className="size-4 text-stone-400 shrink-0 animate-spin" /> : <ArrowRightLeft className="size-4 text-stone-400 shrink-0" />}
                  Convert to Sales Order
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
            {convert.isError && (
              <p role="alert" className="text-2xs text-destructive">{apiErrorMessage(convert.error, 'Failed to convert quote.')}</p>
            )}
            {exportPdfError && (
              <p role="alert" className="text-2xs text-destructive">{exportPdfError}</p>
            )}
          </div>

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={color}>{quote.status}</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Customer</span>
              <span className="text-stone-700 truncate max-w-[140px]">{quote.customer.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(quote.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(quote.updatedAt)}</span>
            </div>
          </div>

          {canDelete && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeleteQuoteDialog
                quoteId={id}
                label={`Quote ${quote.quoteNumber}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['quotes'] });
                  navigate('/sales/quote');
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

function addressRows(addr: { customerName?: string; addrLine1?: string; addrLine2?: string; city?: string; stateProvince?: string; postalCode?: string; country?: string }): Array<[string, string]> {
  return [
    ['Name', addr.customerName || ''],
    ['Address', [addr.addrLine1, addr.addrLine2].filter(Boolean).join(', ')],
    ['City/State/Zip', [addr.city, addr.stateProvince, addr.postalCode].filter(Boolean).join(', ')],
    ['Country', addr.country || ''],
  ];
}

function AddressBlock({ addr }: { addr: { customerName?: string; addrLine1?: string; addrLine2?: string; city?: string; stateProvince?: string; postalCode?: string; country?: string } }) {
  const lines = [
    [addr.addrLine1, addr.addrLine2].filter(Boolean).join(', '),
    [addr.city, addr.stateProvince, addr.postalCode].filter(Boolean).join(', '),
    addr.country,
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
