// The tenant's cutout types (Sink, Cooktop, Faucet, Fireplace, Bathtub, Other),
// read from master data — never hard-coded — and shared by the Cutout dialog.

import { useQuery } from '@tanstack/react-query';
import { drawingService, type CutoutTypeOption } from '@/services/drawingService';

export function useCutoutTypes(): { types: CutoutTypeOption[]; isLoading: boolean; isError: boolean } {
  const query = useQuery({
    queryKey: ['drawing-cutout-types'],
    queryFn: () => drawingService.getCutoutTypes(),
    staleTime: Infinity,
  });
  return { types: query.data ?? [], isLoading: query.isLoading, isError: query.isError };
}
