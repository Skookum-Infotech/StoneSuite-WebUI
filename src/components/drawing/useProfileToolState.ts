// What the Profiles tool is holding between clicks: the profile type picked in
// the bottom bar's list, and the measurement preset picked for it. Both outlive
// the tool being closed, so reopening Profiles carries on with the same pick.
// Nothing is picked until the user picks one; the first type (and its first
// preset) stand in (see useSelectedProfileType / useSelectedProfileMeasurement).
// Picking a different type clears any picked measurement, since a preset from
// one type rarely makes sense for another.

import { useCallback, useMemo, useState } from 'react';

export interface ProfileToolState {
  /** The picked profile type's id, or null while nothing has been picked. */
  typeId: string | null;
  setTypeId: (typeId: string | null) => void;
  /** The picked measurement preset, in mm, or null to fall back to the type's first. */
  measurementMm: number | null;
  setMeasurementMm: (measurementMm: number | null) => void;
}

export function useProfileToolState(): ProfileToolState {
  const [typeId, setTypeIdState] = useState<string | null>(null);
  const [measurementMm, setMeasurementMm] = useState<number | null>(null);
  const setTypeId = useCallback((id: string | null) => {
    setTypeIdState(id);
    setMeasurementMm(null);
  }, []);
  return useMemo(() => ({ typeId, setTypeId, measurementMm, setMeasurementMm }), [typeId, setTypeId, measurementMm]);
}
