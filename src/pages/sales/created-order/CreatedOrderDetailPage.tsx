import { useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, Pencil } from 'lucide-react';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/api/tenantClient';
import { isOrderNotFound, useCreatedOrder } from '@/hooks/useCreatedOrder';
import { cityZipLabel, orderStatusLabel } from '@/lib/createdOrderDisplay';
import { CREATED_ORDERS_PATH, createdOrderEditPath } from '@/lib/createdOrderRoutes';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { CreatedOrderDetails } from './components/CreatedOrderDetails';

// One of the customer's own submitted orders: the project details and every
// area exactly as they were filed. While the fabricator's draft of it has not
// been moved on, it can be changed (Edit order); after that it is read-only.
// The server answers 404 for an id that is not theirs, so a missing and a
// foreign order read the same.
export default function CreatedOrderDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orderQ = useCreatedOrder(id);
  const order = orderQ.data;

  const backToList = (): void => {
    void navigate(CREATED_ORDERS_PATH);
  };
  const address = order
    ? [order.installAddress, cityZipLabel(order.city, order.zip)].filter(Boolean).join(', ')
    : '';

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <CrmPageHeader
        backLabel="Created Orders"
        onBack={backToList}
        icon={ClipboardList}
        title={order ? order.builder : 'Order'}
        subtitle={address || undefined}
        statusBadge={
          order ? (
            <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-100 px-2.5 py-0.5 text-label font-semibold text-stone-600">
              {orderStatusLabel(order.status)}
            </span>
          ) : undefined
        }
        actions={
          order?.editable ? (
            <Button type="button" onClick={() => void navigate(createdOrderEditPath(order.id))}>
              <Pencil aria-hidden="true" />
              Edit order
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 space-y-6 p-4 sm:p-6 3xl:p-10 4xl:p-14">
        {orderQ.isLoading && <Spinner label="Loading order…" />}

        {orderQ.isError && (
          <div className="space-y-3">
            <ErrorNote>
              {isOrderNotFound(orderQ.error)
                ? 'We could not find this order.'
                : apiErrorMessage(orderQ.error, 'We could not load this order.')}
            </ErrorNote>
            <Button type="button" variant="outline" onClick={backToList}>
              View all orders
            </Button>
          </div>
        )}

        {order && !order.editable && (
          <p
            role="status"
            className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600"
          >
            This order is now being processed, so it can't be changed here. Please contact us if
            something needs to change.
          </p>
        )}

        {order && <CreatedOrderDetails order={order} />}
      </div>
    </div>
  );
}
