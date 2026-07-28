import { useQuery } from '@tanstack/react-query';
import { inventoryLookupService } from '@/services/inventoryLookupService';

// Shared cache for every inventory form's vocabularies (materials, colors,
// finishes, reasons, units, tax-rates, warehouses + the CHECK-constraint
// enums) — what an item, unit, bin, bundle or document form loads on open.
export function useInventoryLookups() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-lookups'],
    queryFn: inventoryLookupService.getAll,
    staleTime: 5 * 60 * 1000,
  });

  return { lookups: data, isLoading, error };
}
