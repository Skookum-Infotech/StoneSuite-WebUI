import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { salesOrderService } from '@/services/salesOrderService';
import { isPortalSession } from '@/store/useAuthStore';
import { CustomerOrderFormDialog } from './CustomerOrderFormDialog';

interface CustomerOrderFormActionProps {
  orderId: string;
  /** Whether the Sales Order is still a Draft. */
  isDraft: boolean;
}

// The "Customer Order Form" button, in the page header beside Back so it is
// seen without hunting: shown only on a Sales Order that was drafted from a
// customer's portal order, and it opens that form in a big read-only modal. The lookup is its own query so the detail page carries no
// extra load for orders that have no form (the server answers 404, read here
// as "none").
export function CustomerOrderFormAction({ orderId, isDraft }: CustomerOrderFormActionProps) {
  const [open, setOpen] = useState(false);
  const formQ = useQuery({
    queryKey: ['sales-order', orderId, 'customer-order-form'],
    queryFn: () => salesOrderService.getCustomerOrderForm(orderId),
    // A portal session has no such route; the customer has their own pages.
    enabled: orderId !== '' && !isPortalSession(),
  });
  const form = formQ.data;
  if (!form) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View customer order form"
        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
      >
        <ClipboardList className="size-3.5" aria-hidden="true" />
        Customer Order Form
      </button>
      {open && (
        <CustomerOrderFormDialog
          orderId={orderId}
          form={form}
          isDraft={isDraft}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
