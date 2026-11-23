// The profile type the Profiles tool paints with: the one picked in the bar, or
// the first in the shop's list until something is picked (or when the picked
// one is no longer in the list). Undefined while the list is empty or still
// loading.

import type { AttachedProfileType } from '@/types/drawing';
import { useDrawingEditor } from './DrawingEditorContext';
import { useAttachedProfileTypeList } from './AttachedProfileTypesContext';

export function useSelectedProfileType(): AttachedProfileType | undefined {
  const { profile } = useDrawingEditor();
  const types = useAttachedProfileTypeList();
  return types.find((t) => t.id === profile.typeId) ?? types[0];
}
