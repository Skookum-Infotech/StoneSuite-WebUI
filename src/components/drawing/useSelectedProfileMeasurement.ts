// The measurement the Profiles tool paints with, in mm: the preset picked in
// the bar, or the selected type's first preset until one is picked. Undefined
// while no type is selected or that type has no presets.

import { useDrawingEditor } from './DrawingEditorContext';
import { useSelectedProfileType } from './useSelectedProfileType';

export function useSelectedProfileMeasurement(): number | undefined {
  const { profile } = useDrawingEditor();
  const type = useSelectedProfileType();
  return profile.measurementMm ?? type?.measurementPresetsMm[0];
}
