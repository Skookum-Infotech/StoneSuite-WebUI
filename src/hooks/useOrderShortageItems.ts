import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { inventoryService } from '@/services/inventoryService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useItemUnitCode } from '@/hooks/useItemUnitCode';
import {
  NEW_PURCHASE_ORDER_PATH, purchaseOrderPrefillLines, purchaseOrderPrefillState,
} from '@/lib/purchaseOrderPrefill';
import type { StockShortage } from '@/types/salesOrder';

const ITEM_STALE_MS = 60 * 1000;

/** "Order shortage items": loads each short item (for its standard size,
 *  thickness and purchasing price), then opens a new purchase order in this tab
 *  with one line per item, sized to cover the shortfall. */
export function useOrderShortageItems(): { order: (shortages: StockShortage[]) => void; isPending: boolean } {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const unitCodeFor = useItemUnitCode();

  const mutation = useMutation({
    mutationFn: (shortages: StockShortage[]) => Promise.all(shortages.map((s) => queryClient.fetchQuery({
      queryKey: ['inventory-item', s.itemId],
      queryFn: () => inventoryService.getItem(s.itemId),
      staleTime: ITEM_STALE_MS,
    }))),
    onSuccess: (items, shortages) => {
      const lines = purchaseOrderPrefillLines(shortages, items, unitCodeFor);
      navigate(NEW_PURCHASE_ORDER_PATH, { state: purchaseOrderPrefillState(lines) });
    },
    onError: (err) => toast.error(`Couldn't load the short items for a purchase order: ${apiErrorMessage(err)}`),
  });

  return { order: mutation.mutate, isPending: mutation.isPending };
}
