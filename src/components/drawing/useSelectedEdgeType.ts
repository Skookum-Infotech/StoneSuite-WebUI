// The edge type the Edges tool paints with: the one picked in the bar, or the
// first in the shop's list until something is picked (or when the picked one is
// no longer in the list). Undefined while the list is empty or still loading.

import type { EdgeType } from '@/types/drawing';
import { useDrawingEditor } from './DrawingEditorContext';
import { useEdgeTypeList } from './EdgeTypesContext';

export function useSelectedEdgeType(): EdgeType | undefined {
  const { edge } = useDrawingEditor();
  const types = useEdgeTypeList();
  return types.find((t) => t.id === edge.typeId) ?? types[0];
}
