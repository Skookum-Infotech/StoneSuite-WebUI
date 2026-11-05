// The tenant's edge profile list, shared by every edge/cutout picker.

import { useQuery } from '@tanstack/react-query';
import { drawingService, type EdgeCode } from '@/services/drawingService';

export function useEdgeCodes(): EdgeCode[] {
  const query = useQuery({ queryKey: ['drawing-edge-codes'], queryFn: () => drawingService.getEdgeCodes(), staleTime: Infinity });
  return query.data ?? [];
}
