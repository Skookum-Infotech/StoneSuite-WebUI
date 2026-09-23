import { useNavigate } from 'react-router-dom';
import { Package, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { UploadDocumentButton } from '@/components/tenant/UploadDocumentButton';
import { PurchaseOrderTable } from './components/PurchaseOrderTable';

export default function PurchaseOrderListPage() {
  const navigate = useNavigate();
  const { hasPermission, isLoading } = useUserPermissions();
  const canCreate = isLoading || hasPermission('purchase_order', 'create');

  // TODO(backend): there is no upload endpoint yet, so a picked file is only
  // acknowledged, never sent. To wire it up, add the call to purchaseOrderService,
  // run it through a useMutation, and invalidate ['purchase-orders'] on success.
  function handleFileSelected(file: File) {
    toast.info(`"${file.name}" selected — sending it to the backend isn't wired up yet.`);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <Package className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Purchase Orders</h1>
              <p className="text-sm text-stone-500">Create and manage purchase orders sent to vendors.</p>
            </div>
          </div>
          {canCreate && (
            <button
              onClick={() => navigate('/purchases/purchase_order/new')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95"
            >
              <Plus className="size-3.5" />
              New Purchase Order
            </button>
          )}
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0">
          <PurchaseOrderTable
            toolbarActions={
              canCreate && (
                <UploadDocumentButton documentLabel="Purchase Order" onFileSelected={handleFileSelected} />
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
