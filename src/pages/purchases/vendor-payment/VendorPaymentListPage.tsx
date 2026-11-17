import { useNavigate } from 'react-router-dom';
import { Wallet, Plus } from 'lucide-react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { VendorPaymentTable } from './components/VendorPaymentTable';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
export default function VendorPaymentListPage() {
  const navigate = useNavigate();
  const { hasPermission, isLoading } = useUserPermissions();
  const canCreate = isLoading || hasPermission('vendor_payment', 'create');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <Wallet className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="type-page-title">Vendor Payments</h1>
              <p className="text-sm text-stone-500">Pay vendor bills and track what's still unapplied.</p>
            </div>
          </div>
          {canCreate && (
            <button
              onClick={() => navigate('/purchases/vendor_payment/new')}
              className={cn(buttonVariants(), 'active:scale-95')}
            >
              <Plus className="size-3.5" />
              Record Payment
            </button>
          )}
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0">
          <VendorPaymentTable />
        </div>
      </div>
    </div>
  );
}
