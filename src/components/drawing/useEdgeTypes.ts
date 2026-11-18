// The shop's edge types (Ease, Appliance ...) from the server, and saving one:
// a new type or a change to an existing one. Saving refreshes the list so the
// Edges bar and every painted side pick up the new name and colour at once.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { drawingService } from '@/services/drawingService';
import type { EdgeType } from '@/types/drawing';
import type { EdgeTypeInput } from '@/lib/drawing/edgeTypes';

const EDGE_TYPES_KEY = ['drawing-edge-types'];

export function useEdgeTypes(): { types: EdgeType[]; isLoading: boolean } {
  const query = useQuery({ queryKey: EDGE_TYPES_KEY, queryFn: () => drawingService.getEdgeTypes(), staleTime: Infinity });
  return { types: query.data ?? [], isLoading: query.isLoading };
}

/** `id` set saves a change to that type; left out it adds a new one. */
export function useSaveEdgeType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: EdgeTypeInput }) => (
      id ? drawingService.updateEdgeType(id, input) : drawingService.createEdgeType(input)
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EDGE_TYPES_KEY }),
  });
}
