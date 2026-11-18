// What the Edges tool is holding between clicks: the edge type picked in the
// bottom bar's list. It outlives the tool being closed, so reopening Edges
// carries on with the same type. Nothing is picked until the user picks one; the
// first type in the list stands in (see useSelectedEdgeType).

import { useMemo, useState } from 'react';

export interface EdgeToolState {
  /** The picked edge type's id, or null while nothing has been picked. */
  typeId: string | null;
  setTypeId: (typeId: string | null) => void;
}

export function useEdgeToolState(): EdgeToolState {
  const [typeId, setTypeId] = useState<string | null>(null);
  return useMemo(() => ({ typeId, setTypeId }), [typeId]);
}
