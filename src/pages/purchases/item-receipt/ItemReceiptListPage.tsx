import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, Plus } from 'lucide-react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { ItemReceiptTable } from './components/ItemReceiptTable';
import { PurchaseOrderPickerDialog } from './components/PurchaseOrderPickerDialog';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
export default function ItemReceiptListPage() {
  const navigate = useNavigate();
  const { hasPermission, isLoading } = useUserPermissions();
  // A new receipt is saved and posted in one step, so it takes both grants.
  const canCreate = isLoading || (hasPermission('item_receipt', 'create') && hasPermission('item_receipt', 'transition'));
  // The picker's empty state can jump straight to PO creation, but only for a
  // user the PO Add route (purchase_order:create) would let through.
  const canCreatePurchaseOrder = !isLoading && hasPermission('purchase_order', 'create');
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <Inbox className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="type-page-title">Item Receipts</h1>
              <p className="type-page-subtitle">Record goods arriving against your purchase orders.</p>
            </div>
          </div>
          {canCreate && (
            <button
              onClick={() => setPickerOpen(true)}
              className={cn(buttonVariants(), 'active:scale-95')}
            >
              <Plus className="size-3.5" />
              New Receipt
            </button>
          )}
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0">
          <ItemReceiptTable />
        </div>
      </div>

      {pickerOpen && (
        <PurchaseOrderPickerDialog
          onClose={() => setPickerOpen(false)}
          onSelect={(purchaseOrderId) => navigate(`/purchases/item_receipt/new?po=${purchaseOrderId}`)}
          onCreatePurchaseOrder={canCreatePurchaseOrder ? () => navigate('/purchases/purchase_order/new') : undefined}
        />
      )}
    </div>
  );
}
