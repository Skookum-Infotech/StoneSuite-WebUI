import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList, Pencil, X } from 'lucide-react';
import { useModalDialog } from '@/hooks/useModalDialog';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { CreatedOrderDetails } from '@/pages/sales/created-order/components/CreatedOrderDetails';
import type { CreatedOrder } from '@/types/createdOrder';
import { CustomerOrderFormEditor } from './CustomerOrderFormEditor';

interface CustomerOrderFormDialogProps {
  orderId: string;
  form: CreatedOrder;
  /** Whether the Sales Order is still a Draft. */
  isDraft: boolean;
  onClose: () => void;
}

// The customer's order form, as the Sales Order's staff see it: big, read-only,
// and identical to what the customer sees in their portal. A super admin also
// gets Edit, which swaps the same body for the form's own fields. Anyone else
// cannot — the server refuses them too, so this is a courtesy, not the gate.
//
// Rendered only while open (see RejectRecordDialog): useModalDialog moves focus
// once per mount, so the content has to mount fresh each time.
export function CustomerOrderFormDialog({ orderId, form, isDraft, onClose }: CustomerOrderFormDialogProps) {
  const [editing, setEditing] = useState(false);
  const { isSuperAdmin } = useUserPermissions();
  const contentRef = useModalDialog(onClose);
  const stopEditing = useCallback(() => setEditing(false), []);

  // z-50, not the 9999 other dialogs use: the date pickers inside this form open
  // in a popover at z-50, which must sit above the overlay (it is appended to
  // the body after it, so equal z-index puts it on top).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-order-form-title"
      onClick={(e) => e.target === e.currentTarget && !editing && onClose()}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-stone-50 shadow-2xl outline-none"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-white px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent">
              <ClipboardList className="size-4 text-accent-foreground" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="customer-order-form-title" className="truncate text-sm font-bold text-stone-900">
                Customer Order Form
              </h2>
              <p className="truncate text-xs text-stone-500">
                {editing
                  ? 'Editing — changes are saved to the customer’s order.'
                  : 'Read-only. This is the form as the customer sees it in their portal.'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isSuperAdmin && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close customer order form"
              className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {editing ? (
          <CustomerOrderFormEditor
            orderId={orderId}
            form={form}
            isDraft={isDraft}
            onCancel={stopEditing}
            onSaved={stopEditing}
          />
        ) : (
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
            <p role="status" className="text-xs text-stone-500">
              {form.editable
                ? 'The customer can still change this order from their portal.'
                : 'This order is locked for the customer: the sales order has moved on from Draft.'}
            </p>
            <CreatedOrderDetails order={form} />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
