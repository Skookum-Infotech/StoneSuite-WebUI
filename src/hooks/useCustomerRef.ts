import { useQuery } from '@tanstack/react-query';
import { crmService } from '@/services/crmService';
import { customerRefFromRecord } from '@/lib/customerDefaults';
import type { CustomerRef } from '@/pages/sales/components/CustomerPicker';

const CUSTOMER_WORKFLOW_KEY = 'customer';

/** Loads a customer CRM record as the same CustomerRef CustomerPicker produces
 *  — for a form that is handed only a customer's id and name (e.g. a credit
 *  memo opened from a payment) and still wants the customer's Bill To address
 *  and defaults. Never cached past unmount: the result is copied into a
 *  document, so a stale address is worse than one extra request. An
 *  unreadable record (say, no customer permission) just leaves `data`
 *  undefined — the caller keeps what it already has. */
export function useCustomerRef(customerId: string | undefined) {
  return useQuery<CustomerRef>({
    queryKey: ['customer-ref', customerId],
    enabled: Boolean(customerId),
    gcTime: 0,
    retry: false,
    queryFn: async () => customerRefFromRecord(await crmService.getRecord(customerId ?? '', CUSTOMER_WORKFLOW_KEY)),
  });
}
