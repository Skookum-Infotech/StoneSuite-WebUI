import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { createdOrderService } from '@/services/createdOrderService';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import type { CreatedOrder } from '@/types/createdOrder';

const HTTP_NOT_FOUND = 404;
const MAX_RETRIES = 2;

/** True for the server's answer to an order that is not the customer's, or does
 *  not exist — the two read the same by design. */
export function isOrderNotFound(err: unknown): boolean {
  return err instanceof AxiosError && err.response?.status === HTTP_NOT_FOUND;
}

/** One of the customer's orders by id, with the breadcrumb named after the job
 *  (never the raw id) for as long as the page using it is mounted. The detail
 *  and edit pages share the query key, so one fetch serves both. */
export function useCreatedOrder(id: string): UseQueryResult<CreatedOrder> {
  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);

  const orderQ = useQuery({
    queryKey: ['created-orders', 'detail', id],
    queryFn: () => createdOrderService.get(id),
    enabled: id !== '',
    retry: (count, err) => !isOrderNotFound(err) && count < MAX_RETRIES,
  });

  const order = orderQ.data;
  const crumb = order ? order.installAddress.trim() || order.builder.trim() : '';
  useEffect(() => {
    if (!crumb) return undefined;
    setLabel(id, crumb);
    return () => clearLabel(id);
  }, [id, crumb, setLabel, clearLabel]);

  return orderQ;
}
