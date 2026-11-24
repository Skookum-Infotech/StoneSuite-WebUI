// The Edges tool's bottom bar: the edge type picked to paint with (a dropdown of
// the shop's list ending in "Add new"), a pencil that edits the picked type, and
// a Close button. Clicking a side of a piece while the tool is armed paints it
// in the picked type's colour (EdgePickLayer). The editor dialog is owned here.

import { useCallback, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useDrawingEditor } from './DrawingEditorContext';
import { EdgeTypeDialog } from './EdgeTypeDialog';
import { EdgeTypePicker } from './EdgeTypePicker';
import { useEdgeTypeList } from './EdgeTypesContext';
import { ToolModeBar } from './ToolModeBar';
import { useEdgeTypes } from './useEdgeTypes';
import { useSelectedEdgeType } from './useSelectedEdgeType';

const NOTHING = () => undefined;

function EdgeBar() {
  const { setTool, edge } = useDrawingEditor();
  const types = useEdgeTypeList();
  const { isLoading } = useEdgeTypes();
  const selected = useSelectedEdgeType();
  const [dialog, setDialog] = useState<'new' | 'edit' | null>(null);
  const close = useCallback(() => setTool('select'), [setTool]);

  return (
    <>
      {/* While the editor is open Escape closes just that — the tool stays armed. */}
      <ToolModeBar name="Edges tool" title="Edges" onClose={dialog ? NOTHING : close}>
        <div className="flex items-center gap-2">
          <EdgeTypePicker types={types} selected={selected} onPick={edge.setTypeId} onAdd={() => setDialog('new')} />
          <button
            type="button"
            aria-label="Edit edge"
            title="Edit edge"
            disabled={!selected}
            onClick={() => setDialog('edit')}
            className="flex h-8 w-9 items-center justify-center rounded-md bg-brand text-ink-strong hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {types.length === 0 && (
          <p role="status" className="max-w-xs text-xs text-stone-300">
            {isLoading ? 'Loading edge types…' : 'No edge types yet. Use Add new to make one.'}
          </p>
        )}
      </ToolModeBar>
      {dialog && (
        <EdgeTypeDialog
          type={dialog === 'edit' ? selected : undefined}
          types={types}
          onSaved={(saved) => edge.setTypeId(saved.id)}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

export function EdgeModeBar() {
  const { tool } = useDrawingEditor();
  // Mounted only while the tool is armed, which is also when Escape closes it.
  return tool === 'edge' ? <EdgeBar /> : null;
}
