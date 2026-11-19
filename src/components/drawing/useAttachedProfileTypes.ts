// The shop's attached-profile types (Backsplash, Lamination ...) from the
// server, and saving one: a new type or a change to an existing one. Saving
// refreshes the list so the Profiles bar and every painted side pick up the
// new name, colour and measurements at once.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { drawingService } from '@/services/drawingService';
import type { AttachedProfileType } from '@/types/drawing';
import type { AttachedProfileTypeInput } from '@/lib/drawing/attachedProfileTypes';

const ATTACHED_PROFILE_TYPES_KEY = ['drawing-attached-profile-types'];

export function useAttachedProfileTypes(): { types: AttachedProfileType[]; isLoading: boolean } {
  const query = useQuery({
    queryKey: ATTACHED_PROFILE_TYPES_KEY, queryFn: () => drawingService.getAttachedProfileTypes(), staleTime: Infinity,
  });
  return { types: query.data ?? [], isLoading: query.isLoading };
}

/** `id` set saves a change to that type; left out it adds a new one. */
export function useSaveAttachedProfileType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: AttachedProfileTypeInput }) => (
      id ? drawingService.updateAttachedProfileType(id, input) : drawingService.createAttachedProfileType(input)
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ATTACHED_PROFILE_TYPES_KEY }),
  });
}
