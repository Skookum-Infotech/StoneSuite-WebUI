// The Profiles tool's bottom bar: the profile type picked to paint with (a
// dropdown of the shop's list ending in "Add new"), the measurement preset to
// paint it at, a pencil that edits the picked type, and a Close button.
// Clicking a side of a piece while the tool is armed paints it with the
// picked type and measurement (ProfilePickLayer). The editor dialog is owned
// here, same shape as EdgeModeBar.

import { useCallback, useState } from 'react';
import { Pencil } from 'lucide-react';
import { formatLength } from '@/lib/drawing/units';
import { Select } from '@/components/ui/select';
import { useDrawingEditor } from './DrawingEditorContext';
import { AttachedProfileTypePicker } from './AttachedProfileTypePicker';
import { ProfileTypeDialog } from './ProfileTypeDialog';
import { useAttachedProfileTypeList } from './AttachedProfileTypesContext';
import { ToolModeBar } from './ToolModeBar';
import { useAttachedProfileTypes } from './useAttachedProfileTypes';
import { useSelectedProfileMeasurement } from './useSelectedProfileMeasurement';
import { useSelectedProfileType } from './useSelectedProfileType';

const NOTHING = () => undefined;

function ProfileBar() {
  const { state, setTool, profile } = useDrawingEditor();
  const { displayUnit, fractionDenominator } = state.present;
  const types = useAttachedProfileTypeList();
  const { isLoading } = useAttachedProfileTypes();
  const selected = useSelectedProfileType();
  const measurementMm = useSelectedProfileMeasurement();
  const [dialog, setDialog] = useState<'new' | 'edit' | null>(null);
  const close = useCallback(() => setTool('select'), [setTool]);

  return (
    <>
      {/* While the editor is open Escape closes just that — the tool stays armed. */}
      <ToolModeBar name="Profiles tool" title="Profiles" onClose={dialog ? NOTHING : close}>
        <div className="flex items-center gap-2">
          <AttachedProfileTypePicker types={types} selected={selected} onPick={profile.setTypeId} onAdd={() => setDialog('new')} />
          {selected && selected.measurementPresetsMm.length > 0 && (
            <Select
              aria-label="Profile measurement"
              value={String(measurementMm ?? selected.measurementPresetsMm[0])}
              onChange={(e) => profile.setMeasurementMm(Number(e.target.value))}
              className="h-8 rounded-md border border-stone-600 bg-stone-800 px-2 text-xs text-stone-100"
            >
              {selected.measurementPresetsMm.map((mm) => (
                <option key={mm} value={mm}>{formatLength(mm, displayUnit, fractionDenominator)}</option>
              ))}
            </Select>
          )}
          <button
            type="button"
            aria-label="Edit profile"
            title="Edit profile"
            disabled={!selected}
            onClick={() => setDialog('edit')}
            className="flex h-8 w-9 items-center justify-center rounded-md bg-brand text-stone-900 hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {types.length === 0 && (
          <p role="status" className="max-w-xs text-xs text-stone-300">
            {isLoading ? 'Loading profile types…' : 'No profile types yet. Use Add new to make one.'}
          </p>
        )}
      </ToolModeBar>
      {dialog && (
        <ProfileTypeDialog
          type={dialog === 'edit' ? selected : undefined}
          types={types}
          onSaved={(saved) => profile.setTypeId(saved.id)}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

export function ProfileModeBar() {
  const { tool } = useDrawingEditor();
  // Mounted only while the tool is armed, which is also when Escape closes it.
  return tool === 'profile' ? <ProfileBar /> : null;
}
