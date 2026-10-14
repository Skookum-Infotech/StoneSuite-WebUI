import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ClipboardPlus, Loader2, Plus } from 'lucide-react';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { Button } from '@/components/ui/button';
import { areaCountLabel, cityZipLabel, orderStatusLabel } from '@/lib/createdOrderDisplay';
import { NEW_CREATED_ORDER_PATH } from '@/lib/createdOrderRoutes';
import { formatDateValue, LIST_DATE_OPTIONS } from '@/lib/dateUtils';
import { apiErrorMessage } from '@/api/tenantClient';
import { createdOrderService } from '@/services/createdOrderService';
import type { CreatedOrder } from '@/types/createdOrder';

const HEADERS = ['Install address', 'Builder', 'Dates', 'Areas', 'Status', 'Submitted'] as const;

const CELL_CLS = 'px-4 py-3 align-top text-xs text-stone-700';
const DATE_LOCALE = 'en-US';

/** A list-column date, or an em dash when the order has none. The server may
 *  send a bare date or a UTC-midnight timestamp; formatDateValue handles both. */
function listDate(value: string): string {
  return formatDateValue(value, DATE_LOCALE, LIST_DATE_OPTIONS) || '—';
}

function EmptyOrders({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <ClipboardPlus className="size-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-stone-900">No orders yet</h2>
      <p className="mt-1 max-w-sm text-sm text-stone-500">
        Fill in the countertop order form and your fabricator receives it straight away. Your orders
        will be listed here.
      </p>
      <Button type="button" className="mt-5" onClick={onCreate}>
        <Plus aria-hidden="true" />
        Create your first order
      </Button>
    </div>
  );
}

function OrderRow({ order }: { order: CreatedOrder }) {
  const place = cityZipLabel(order.city, order.zip);
  const builder = [order.builder, order.community].filter((part) => part.trim() !== '');
  return (
    <tr className="border-b border-stone-100 last:border-0">
      <td className={CELL_CLS}>
        <p className="font-semibold text-stone-900">{order.installAddress}</p>
        {place && <p className="text-stone-500">{place}</p>}
      </td>
      <td className={CELL_CLS}>
        <p className="font-medium text-stone-800">{builder[0] ?? '—'}</p>
        {builder[1] && <p className="text-stone-500">{builder[1]}</p>}
        {order.plan && <p className="text-stone-400">Plan {order.plan}</p>}
      </td>
      <td className={CELL_CLS}>
        <p>
          <span className="text-stone-400">Measure </span>
          {listDate(order.measureDate)}
        </p>
        <p>
          <span className="text-stone-400">Install </span>
          {listDate(order.installDate)}
        </p>
      </td>
      <td className={CELL_CLS}>{areaCountLabel(order.areas.length)}</td>
      <td className={CELL_CLS}>
        <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-100 px-2.5 py-0.5 text-label font-semibold text-stone-600">
          {orderStatusLabel(order.status)}
        </span>
      </td>
      <td className={CELL_CLS}>{listDate(order.createdAt)}</td>
    </tr>
  );
}

// The customer's own countertop orders. Everything the server returns is
// already scoped to the signed-in customer, so this renders it as-is.
export default function CreatedOrderListPage() {
  const navigate = useNavigate();
  const goToNew = (): void => {
    void navigate(NEW_CREATED_ORDER_PATH);
  };

  const ordersQ = useInfiniteQuery({
    queryKey: ['created-orders'],
    queryFn: ({ pageParam }) => createdOrderService.list(pageParam),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
  });

  const orders = ordersQ.data?.pages.flatMap((page) => page.orders) ?? [];

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex flex-1 flex-col min-h-0 p-4 sm:p-6 3xl:p-10 4xl:p-14">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10">
              <ClipboardPlus className="size-5 text-accent-foreground" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Created Orders</h1>
              <p className="text-sm text-stone-500">Countertop orders you have submitted.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={goToNew}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-stone-950 shadow-sm transition hover:bg-brand-hover active:scale-95"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Create Order
          </button>
        </div>

        <div className="mt-5 flex flex-1 flex-col border-t border-stone-100 pt-4">
          {ordersQ.isPending && <Spinner label="Loading orders…" />}

          {ordersQ.isError && (
            <div className="space-y-3">
              <ErrorNote>{apiErrorMessage(ordersQ.error, 'We could not load your orders.')}</ErrorNote>
              <Button type="button" variant="outline" onClick={() => void ordersQ.refetch()}>
                Try again
              </Button>
            </div>
          )}

          {ordersQ.isSuccess && orders.length === 0 && <EmptyOrders onCreate={goToNew} />}

          {ordersQ.isSuccess && orders.length > 0 && (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
                <table className="w-full min-w-[44rem] border-collapse text-left">
                  <caption className="sr-only">Your created orders</caption>
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/70">
                      {HEADERS.map((header) => (
                        <th
                          key={header}
                          scope="col"
                          className="px-4 py-2.5 text-label font-semibold uppercase tracking-wide text-stone-500"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <OrderRow key={order.id} order={order} />
                    ))}
                  </tbody>
                </table>
              </div>
              {ordersQ.hasNextPage && (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={ordersQ.isFetchingNextPage}
                    onClick={() => void ordersQ.fetchNextPage()}
                  >
                    {ordersQ.isFetchingNextPage && <Loader2 className="animate-spin" aria-hidden="true" />}
                    Load more
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
