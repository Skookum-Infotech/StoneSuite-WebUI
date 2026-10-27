import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, FileDown, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { binTransferService } from '@/services/binTransferService';
import { Badge, ErrorNote, Spinner } from '@/components/tenant/ui';
import { DangerZoneAction, DangerZoneCard } from '@/components/tenant/DangerZoneCard';
import { RecordApprovalBanner } from '@/components/tenant/RecordApprovalBanner';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { SalesDetailSidebar } from '@/pages/sales/components/SalesDetailSidebar';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { BT_STATUS_COLORS, btIsEditable } from '@/lib/binTransferStatus';
import { formatDateValue, LIST_DATE_OPTIONS } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { BinTransferActions } from './components/BinTransferActions';
import { BinTransferHistoryTab } from './components/BinTransferHistoryTab';
import { BinTransferOverview } from './components/BinTransferOverview';
import { BinTransferProgress } from './components/BinTransferProgress';

const LIST_PATH = '/inventory/bin_transfer';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'history', label: 'History' },
] as const;
type Tab = (typeof TABS)[number]['key'];

// Status and approval can change under the page from another user or tab, so
// the record is polled at the same cadence as the notification bell.
const DETAIL_POLL_MS = 60_000;

function fmtDate(iso?: string | null): string {
  return iso ? formatDateValue(iso, undefined, LIST_DATE_OPTIONS) : '—';
}

export default function BinTransferDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();

  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const canUpdate = permsLoading || hasPermission('bin_transfer', 'update');
  const canDelete = permsLoading || hasPermission('bin_transfer', 'delete');
  const canTransition = permsLoading || hasPermission('bin_transfer', 'transition');
  const canApprove = permsLoading || hasPermission('bin_transfer', 'approve');

  const { data: transfer, isLoading, error } = useQuery({
    queryKey: ['bin-transfer', id],
    queryFn: () => binTransferService.get(id),
    enabled: Boolean(id),
    refetchInterval: DETAIL_POLL_MS,
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (transfer?.number) {
      setLabel(id, transfer.number);
      return () => clearLabel(id);
    }
  }, [id, transfer?.number, setLabel, clearLabel]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['bin-transfer', id] });
    queryClient.invalidateQueries({ queryKey: ['bin-transfer-history', id] });
    queryClient.invalidateQueries({ queryKey: ['bin-transfers'] });
  }

  const approve = useMutation({
    mutationFn: () => binTransferService.approve(id),
    onSuccess: () => {
      refresh();
      toast.success('Approved.');
    },
  });

  const remove = useMutation({
    mutationFn: () => binTransferService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bin-transfers'] });
      toast.success('Bin transfer deleted.');
      navigate(LIST_PATH);
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading bin transfer…" /></div>;
  if (!transfer) return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load the bin transfer.')}</ErrorNote></div>;

  const color = BT_STATUS_COLORS[transfer.statusCode] ?? '#a8a29e';
  const deletable = transfer.statusCode === 'DRFT' || transfer.statusCode === 'CANC';

  async function handleExportPdf() {
    if (!transfer) return;
    setExportError(undefined);
    setExporting(true);
    try {
      const { exportInventoryRecordToPdf } = await import('@/lib/inventoryPdfExport');
      await exportInventoryRecordToPdf({
        recordType: 'bin_transfer',
        title: transfer.number || 'Bin Transfer',
        recordNumber: transfer.number,
        statusLabel: transfer.statusName,
        createdAt: transfer.createdAt,
        updatedAt: transfer.updatedAt,
        sections: [{
          title: 'Transfer Details',
          rows: [
            ['Location', transfer.warehouseName ?? ''],
            ['Date', fmtDate(transfer.date)],
            ['Requested By', transfer.ownerName ?? ''],
            ['Destination', transfer.toBinSummary ?? ''],
            ['Notes', transfer.notes ?? ''],
          ],
        }],
        linesTable: {
          title: 'Slabs',
          head: ['#', 'Slab', 'Item', 'Area', 'From', 'To'],
          rows: transfer.lines.map((l) => [
            String(l.lineNumber), l.unitSerial, l.inventoryItemName ?? '',
            `${l.area.toFixed(2)} ${l.areaUnitCode ?? ''}`.trim(), l.fromBinPath || 'No bin', l.toBinPath,
          ]),
          numericFrom: 3,
        },
      });
    } catch (err) {
      setExportError(apiErrorMessage(err, 'Failed to export PDF.'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Bin Transfers"
        onBack={() => navigate(LIST_PATH)}
        icon={ArrowLeftRight}
        title={transfer.number || 'Bin Transfer'}
        subtitle={transfer.warehouseName}
        recordNumber={transfer.number}
        statusBadge={<Badge color={color}>{transfer.statusName}</Badge>}
      />

      <RecordApprovalBanner
        record={transfer}
        onApprove={() => approve.mutate()}
        approving={approve.isPending}
        resubmitVia="submit"
        reject={{
          noun: 'bin transfer',
          run: (reason) => binTransferService.reject(id, reason),
          onRejected: () => {
            refresh();
            toast.success('Sent back to draft with your reason.');
          },
        }}
      />
      {transfer.gated && approve.isError && (
        <p role="alert" className="px-5 py-1.5 text-2xs text-destructive 3xl:px-12 4xl:px-16">
          {apiErrorMessage(approve.error, 'Failed to approve the bin transfer.')}
        </p>
      )}

      <BinTransferProgress statusCode={transfer.statusCode} />

      <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-12 4xl:px-16 modal-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 -mb-px px-4 py-3 text-sm font-semibold transition-colors',
              activeTab === tab.key
                ? 'border-brand text-stone-950'
                : 'border-transparent text-stone-500 hover:border-stone-200 hover:text-stone-700',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 3xl:gap-10 4xl:px-16 4xl:py-10 4xl:gap-14">
        <div className="flex-1 space-y-3 min-w-0">
          {activeTab === 'overview' && <BinTransferOverview transfer={transfer} />}
          {activeTab === 'history' && <BinTransferHistoryTab transferId={id} />}
          <div className="h-6" />
        </div>

        <SalesDetailSidebar label="Bin Transfer Details">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-500">Quick Actions</p>
            <div className="space-y-0.5">
              {canUpdate && btIsEditable(transfer.statusCode) && (
                <button
                  type="button"
                  onClick={() => navigate(`${LIST_PATH}/${id}/edit`)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-stone-700 transition-colors hover:bg-stone-50"
                >
                  <Pencil className="size-4 shrink-0 text-stone-400" /> Edit transfer
                </button>
              )}
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exporting}
                aria-label="Export as PDF"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting ? <Loader2 className="size-4 shrink-0 animate-spin text-stone-400" /> : <FileDown className="size-4 shrink-0 text-stone-400" />}
                {exporting ? 'Exporting…' : 'Export PDF'}
              </button>
            </div>
            {exportError && <p role="alert" className="text-2xs text-destructive">{exportError}</p>}
          </div>

          {(transfer.nextStatusCodes.length > 0) && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-stone-500">Actions</p>
              <BinTransferActions transfer={transfer} can={{ transition: canTransition, approve: canApprove }} />
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-500">Status</p>
            <div className="flex items-center justify-between border-b border-stone-100 py-2 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={color}>{transfer.statusName}</Badge>
            </div>
            <div className="flex items-center justify-between border-b border-stone-100 py-2 text-xs">
              <span className="text-stone-500">Requested by</span>
              <span className="max-w-[140px] truncate text-stone-700">{transfer.ownerName || '—'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-stone-100 py-2 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(transfer.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(transfer.updatedAt)}</span>
            </div>
          </div>

          {canDelete && deletable && (
            <DangerZoneCard>
              <DangerZoneAction
                description="Delete this bin transfer permanently."
                buttonLabel={remove.isPending ? 'Deleting…' : 'Delete transfer'}
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
                hint={remove.isError ? apiErrorMessage(remove.error, 'Failed to delete the bin transfer.') : undefined}
              />
            </DangerZoneCard>
          )}
        </SalesDetailSidebar>
      </div>
    </div>
  );
}
