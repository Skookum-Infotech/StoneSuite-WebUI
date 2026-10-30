import { useQuery } from '@tanstack/react-query';
import { inventoryStockService } from '@/services/inventoryStockService';

/** On-hand totals for the items on screen, keyed by item uuid. Re-reads when the
 *  set of items changes; a reorder point saved on an item's Stock tab refreshes
 *  it through the shared `inventory-stock-totals` key. */
export function useStockTotals(itemIds: string[]) {
  return useQuery({
    queryKey: ['inventory-stock-totals', itemIds],
    queryFn: () => inventoryStockService.totals(itemIds),
    enabled: itemIds.length > 0,
  });
}
