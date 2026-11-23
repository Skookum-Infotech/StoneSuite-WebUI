import { useNavigate, useParams } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { Button } from '@/components/ui/button';
import { isOrderNotFound, useCreatedOrder } from '@/hooks/useCreatedOrder';
import { CREATED_ORDERS_PATH, createdOrderPath } from '@/lib/createdOrderRoutes';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { CreatedOrderForm } from './components/CreatedOrderForm';

const LOCKED_MESSAGE =
  "This order is now being processed and can't be changed here. Please contact us if something needs to change.";

// Change one of the customer's orders while its Sales Order is still a draft.
// Once staff move it on, `editable` is false and the form is never shown; the
// server refuses the save in that case too, so a stale page cannot slip a
// change through.
export default function EditCreatedOrderPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orderQ = useCreatedOrder(id);
  const order = orderQ.data;

  if (order?.editable) {
    return <CreatedOrderForm order={order} />;
  }

  const goTo = (path: string): void => {
    void navigate(path);
  };
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <CrmPageHeader
        backLabel={order ? 'Order' : 'Created Orders'}
        onBack={() => goTo(order ? createdOrderPath(order.id) : CREATED_ORDERS_PATH)}
        icon={ClipboardList}
        title="Edit Order"
        subtitle="Countertop order form"
      />
      <div className="flex-1 space-y-3 p-4 sm:p-6 3xl:p-10 4xl:p-14">
        {orderQ.isLoading && <Spinner label="Loading order…" />}

        {orderQ.isError && (
          <>
            <ErrorNote>
              {isOrderNotFound(orderQ.error)
                ? 'We could not find this order.'
                : apiErrorMessage(orderQ.error, 'We could not load this order.')}
            </ErrorNote>
            <Button type="button" variant="outline" onClick={() => goTo(CREATED_ORDERS_PATH)}>
              View all orders
            </Button>
          </>
        )}

        {order && !order.editable && (
          <>
            <ErrorNote>{LOCKED_MESSAGE}</ErrorNote>
            <Button type="button" variant="outline" onClick={() => goTo(createdOrderPath(order.id))}>
              View order
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
