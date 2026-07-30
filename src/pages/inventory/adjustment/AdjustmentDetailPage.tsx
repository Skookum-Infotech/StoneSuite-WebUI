import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ClipboardEdit, Pencil, Trash2 } from 'lucide-react';
import { inventoryAdjustmentService } from '@/services/inventoryAdjustmentService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { SalesDetailSidebar } from '@/pages/sales/components/SalesDetailSidebar';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { DocumentStatusBar } from '@/components/inventory/DocumentStatusBar';
import { docStatusLabel, DOC_STATUS_COLORS } from '@/lib/inventoryDocumentStatus';

export default function AdjustmentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const canUpdate = permsLoading || hasPermission('inventory_adjustment', 'update');
  const canDelete = permsLoading || hasPermission('inventory_adjustment', 'delete');
  const canTransition = permsLoading || hasPermission('inventory_adjustment', 'transition');
  const canApprove = permsLoading || hasPermission('inventory_adjustment', 'approve');

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-adjustment', id],
    queryFn: () => inventoryAdjustmentService.get(id),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-adjustment', id] });
    queryClient.invalidateQueries({ queryKey: ['inventory-adjustments'] });
  };

  const { mutate: transition, isPending: transitioning } = useMutation({
    // Posting is refused through the generic endpoint server-side — route it
    // to the dedicated /post call instead of surfacing that rejection.
    mutationFn: (to: string) => (to === 'POST' ? inventoryAdjustmentService.post(id) : inventoryAdjustmentService.transition(id, to)),
    onSuccess: invalidate,
    onError: (err) => setActionError(apiErrorMessage(err, 'Failed to change status.')),
  });

  const { mutate: remove } = useMutation({
    mutationFn: () => inventoryAdjustmentService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory-adjustments'] }); navigate('/inventory/adjustment'); },
    onError: (err) => setActionError(apiErrorMessage(err, 'Failed to delete adjustment.')),
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading adjustment…" /></div>;
  if (error || !data) return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load adjustment.')}</ErrorNote></div>;

  const { adjustment: a, nextStatuses } = data;
  const isDraft = a.statusCode === 'DRFT';

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Adjustments"
        onBack={() => navigate('/inventory/adjustment')}
        icon={ClipboardEdit}
        title={a.number || 'Adjustment'}
        subtitle={a.warehouseName}
        statusBadge={<Badge color={DOC_STATUS_COLORS[a.statusCode] ?? '#a8a29e'}>{docStatusLabel(a.statusCode)}</Badge>}
      />

      {actionError && <p className="px-5 py-2 text-xs text-destructive border-b border-red-100 bg-red-50">{actionError}</p>}

      <div className="flex flex-col lg:flex-row gap-6 px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 3xl:gap-10 4xl:px-16 4xl:py-10 4xl:gap-14">
        <div className="flex-1 space-y-3 min-w-0">
          <ModernSection title="Header" index={0}>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <ReadonlyField label="Date" value={a.date} />
              <ReadonlyField label="Warehouse" value={a.warehouseName} />
              <ReadonlyField label="Document Reason" value={a.reasonName} />
              <ReadonlyField label="Net Delta" value={a.netDelta.toFixed(2)} />
              {a.notes && <ReadonlyField label="Notes" value={a.notes} />}
            </div>
          </ModernSection>

          <ModernSection title={`Lines (${a.lines.length})`} index={1}>
            <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-stone-500">Item</th>
                    <th className="px-3 py-2 font-semibold text-stone-500">Unit</th>
                    <th className="px-3 py-2 font-semibold text-stone-500">Reason</th>
                    <th className="px-3 py-2 font-semibold text-stone-500 text-right">Qty Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {a.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2.5 text-stone-800">{line.inventoryItemName || '—'}</td>
                      <td className="px-3 py-2.5 text-stone-500">{line.unitSerial || '—'}</td>
                      <td className="px-3 py-2.5 text-stone-500">{line.reasonName || '—'}</td>
                      <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${line.qtyDelta < 0 ? 'text-destructive' : 'text-emerald-600'}`}>{line.qtyDelta > 0 ? '+' : ''}{line.qtyDelta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ModernSection>
        </div>

        <SalesDetailSidebar label="Adjustment Details">
          {canUpdate && isDraft && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-0.5 mb-4">
              <button type="button" onClick={() => navigate(`/inventory/adjustment/${id}/edit`)} className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 text-xs text-stone-700 w-full transition-colors text-left">
                <Pencil className="size-4 text-stone-400 shrink-0" /> Edit adjustment
              </button>
            </div>
          )}

          {canTransition && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 mb-4">
              <DocumentStatusBar
                statusCode={a.statusCode}
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
                <Trash2 className="size-4 shrink-0" /> Delete adjustment
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
