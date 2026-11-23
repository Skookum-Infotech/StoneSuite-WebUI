import { useCustomerTransactionsSummary } from '@/hooks/useCustomerTransactions';
import { CustomerTransactionSummary } from './CustomerTransactionSummary';

/**
 * The AR summary tiles for a customer, fetched on their own. Shares its
 * query (and cache) with the Transactions tab. Purely supplementary: while
 * loading, or if the call fails, it renders nothing rather than disturb the page.
 */
export function CustomerSummaryStrip({ customerId }: { customerId: string }) {
  const { data } = useCustomerTransactionsSummary(customerId);
  if (!data) return null;
  return <CustomerTransactionSummary summary={data.summary} scopeLimited={data.scopeLimited} />;
}
