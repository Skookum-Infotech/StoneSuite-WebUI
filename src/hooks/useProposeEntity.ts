import { useMutation, useQueryClient } from '@tanstack/react-query';
import { documentExtractionService } from '@/services/documentExtractionService';
import type { ProposeEntityOverrides } from '@/types/documentExtraction';
import type { ProposedAction } from '@/types/proposedAction';

/** Variables of the propose call: the entity key and any inputs the user typed. */
export interface ProposeEntityVars {
  key: string;
  overrides?: ProposeEntityOverrides;
}

/** Query key of one extraction (same key useDocumentReview reads). */
export const extractionQueryKey = (id: string) => ['document-extraction', id] as const;

/** Proposes creating an unmatched customer/vendor/item, then refetches the
 *  extraction so the entity carries its latest proposal. A failed call also
 *  refetches: 404/409 mean the entity or extraction changed server-side. */
export function useProposeEntity(extractionId: string) {
  const qc = useQueryClient();
  return useMutation<ProposedAction, Error, ProposeEntityVars>({
    mutationFn: ({ key, overrides }) => documentExtractionService.proposeEntity(extractionId, key, overrides),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: extractionQueryKey(extractionId) });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: extractionQueryKey(extractionId) });
    },
  });
}
