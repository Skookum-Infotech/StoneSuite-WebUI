import { useVendorTransactionsSummary } from '@/hooks/useVendorTransactions';
import { VendorTransactionSummary } from './VendorTransactionSummary';

/**
 * The payables summary tiles for a vendor, fetched on their own. Shares its
 * query (and cache) with the Transactions tab. Purely supplementary: while
 * loading, or if the call fails, it renders nothing rather than disturb the page.
 */
export function VendorSummaryStrip({ vendorId }: { vendorId: string }) {
  const { data } = useVendorTransactionsSummary(vendorId);
  if (!data) return null;
  return <VendorTransactionSummary summary={data.summary} scopeLimited={data.scopeLimited} />;
}
