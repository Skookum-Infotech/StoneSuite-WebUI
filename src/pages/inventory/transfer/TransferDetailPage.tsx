import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Repeat, Pencil, Trash2, Truck } from 'lucide-react';
import { inventoryTransferService } from '@/services/inventoryTransferService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { SalesDetailSidebar } from '@/pages/sales/components/SalesDetailSidebar';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { DocumentStatusBar } from '@/components/inventory/DocumentStatusBar';
import { docStatusLabel, DOC_STATUS_COLORS } from '@/lib/inventoryDocumentStatus';

export default function TransferDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const canUpdate = permsLoading || hasPermission('inventory_transfer', 'update');
  const canDelete = permsLoading || hasPermission('inventory_transfer', 'delete');
  const canTransition = permsLoading || hasPermission('inventory_transfer', 'transition');
  const canApprove = permsLoading || hasPermission('inventory_transfer', 'approve');

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-transfer', id],
    queryFn: () => inventoryTransferService.get(id),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-transfer', id] });
    queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-transfers-in-transit'] });
  };

  const { mutate: transition, isPending: transitioning } = useMutation({
    // TRNS and RCVD are refused through the generic endpoint server-side —
    // route them to the dedicated ship/receive calls instead.
    mutationFn: (to: string) => {
      if (to === 'TRNS') return inventoryTransferService.ship(id);
      if (to === 'RCVD') return inventoryTransferService.receive(id);
      return inventoryTransferService.transition(id, to);
    },
    onSuccess: invalidate,
    onError: (err) => setActionError(apiErrorMessage(err, 'Failed to change status.')),
  });

  const { mutate: remove } = useMutation({
    mutationFn: () => inventoryTransferService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] }); navigate('/inventory/transfer'); },
    onError: (err) => setActionError(apiErrorMessage(err, 'Failed to delete transfer.')),
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading transfer…" /></div>;
  if (error || !data) return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load transfer.')}</ErrorNote></div>;

  const { transfer: t, nextStatuses } = data;
  const isDraft = t.statusCode === 'DRFT';
  const isInTransit = t.statusCode === 'TRNS';

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Transfers"
        onBack={() => navigate('/inventory/transfer')}
        icon={Repeat}
        title={t.number || 'Transfer'}
        subtitle={`${t.fromWarehouseName ?? '—'} → ${t.toWarehouseName ?? '—'}`}
        statusBadge={<Badge color={DOC_STATUS_COLORS[t.statusCode] ?? '#a8a29e'}>{docStatusLabel(t.statusCode)}</Badge>}
      />

      {actionError && <p className="px-5 py-2 text-xs text-destructive border-b border-red-100 bg-red-50">{actionError}</p>}

      <div className="flex flex-col lg:flex-row gap-6 px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 3xl:gap-10 4xl:px-16 4xl:py-10 4xl:gap-14">
        <div className="flex-1 space-y-3 min-w-0">
          {isInTransit && (
            <div className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
              <Truck className="mt-0.5 size-4 shrink-0 text-indigo-500" />
              <p className="text-xs text-indigo-700">This transfer has shipped — stock shows in neither warehouse until it is received. This is expected, not missing stock.</p>
            </div>
          )}

          <ModernSection title="Header" index={0}>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <ReadonlyField label="From Warehouse" value={t.fromWarehouseName} />
              <ReadonlyField label="To Warehouse" value={t.toWarehouseName} />
              <ReadonlyField label="To Bin" value={t.toBinPath} />
              <ReadonlyField label="Date" value={t.date} />
              <ReadonlyField label="Expected Date" value={t.expectedDate ?? undefined} />
              <ReadonlyField label="Carrier" value={t.carrier} />
              <ReadonlyField label="Tracking #" value={t.trackingNumber} />
              <ReadonlyField label="Total Qty" value={String(t.totalQty)} />
              {t.notes && <ReadonlyField label="Notes" value={t.notes} />}
            </div>
          </ModernSection>

          <ModernSection title={`Lines (${t.lines.length})`} index={1}>
            <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-stone-500">Item</th>
                    <th className="px-3 py-2 font-semibold text-stone-500">Unit</th>
                    <th className="px-3 py-2 font-semibold text-stone-500 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {t.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2.5 text-stone-800">{line.inventoryItemName || '—'}</td>
                      <td className="px-3 py-2.5 text-stone-500">{line.unitSerial || '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-stone-700">{line.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ModernSection>
        </div>

        <SalesDetailSidebar label="Transfer Details">
          {canUpdate && isDraft && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-0.5 mb-4">
              <button type="button" onClick={() => navigate(`/inventory/transfer/${id}/edit`)} className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 text-xs text-stone-700 w-full transition-colors text-left">
                <Pencil className="size-4 text-stone-400 shrink-0" /> Edit transfer
              </button>
            </div>
          )}

          {canTransition && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 mb-4">
              <DocumentStatusBar
                statusCode={t.statusCode}
                nextStatuses={nextStatuses}
                onTransition={transition}
                canTransition={canTransition}
                canApprove={canApprove}
                isPending={transitioning}
              />
            </div>
          )}

          {canDelete && isDraft && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-0.5 mb-4">
              <p className="text-xs font-semibold text-red-400 mb-2">Danger Zone</p>
              <button type="button" onClick={() => remove()} className="flex items-center gap-2.5 hover:bg-destructive/5 rounded-lg px-3 py-2 text-xs text-destructive w-full transition-colors text-left">
                <Trash2 className="size-4 shrink-0" /> Delete transfer
              </button>
            </div>
          )}
        </SalesDetailSidebar>
      </div>
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-1">
      <label className={fieldLabelCls}>{label}</label>
      <div className={readonlyCls}>{value || <span className="text-stone-400">—</span>}</div>
    </div>
  );
}
