// Area tab bar: switch, add, rename, set code, reorder, and delete (with
// confirm) — build spec Task 3's "Area: add, rename, set code, reorder,
// delete with confirm". The delete confirm follows DeleteRefundDialog.tsx's
// useModalDialog + createPortal pattern — this repo has no Dialog
// primitive, every dialog hand-rolls its own overlay and focus handling.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalDialog } from '@/hooks/useModalDialog';
import { useDrawingEditor } from './DrawingEditorContext';

export function AreaTabs() {
  const { state, dispatch } = useDrawingEditor();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const areas = state.present.areas;
  const onlyOneArea = areas.length <= 1;
  const addAreaButtonRef = useRef<HTMLButtonElement>(null);
  // Set only by the delete-confirm button below. useModalDialog restores
  // focus to whatever opened the dialog (the area's own "×" button) on
  // close, but confirming deletes that exact area — focusing a button
  // that's been removed from the DOM is a no-op, stranding focus on
  // <body>. Found in the a11y review.
  const pendingDeleteFocusRef = useRef(false);

  useEffect(() => {
    if (pendingDeleteFocusRef.current) {
      addAreaButtonRef.current?.focus();
      pendingDeleteFocusRef.current = false;
    }
  }, [areas.length]);

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const commitRename = (id: string) => {
    dispatch({ type: 'renameArea', areaId: id, name: renameValue });
    setRenamingId(null);
  };

  const move = (areaId: string, direction: -1 | 1) => {
    const ids = areas.map((a) => a.id);
    const index = ids.indexOf(areaId);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    dispatch({ type: 'reorderAreas', areaIds: ids });
  };

  return (
    <div role="tablist" aria-label="Drawing areas" className="flex items-center gap-1 overflow-x-auto">
      {areas.map((area, index) => (
        <div key={area.id} className="flex items-center gap-0.5 rounded border border-stone-200 px-1 py-0.5">
          {renamingId === area.id ? (
            <input
              autoFocus
              aria-label={`Rename ${area.name}`}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => commitRename(area.id)}
              onKeyDown={(e) => e.key === 'Enter' && commitRename(area.id)}
              className="w-20 rounded border border-stone-200 px-1"
            />
          ) : (
            <button
              type="button"
              role="tab"
              aria-selected={area.id === state.activeAreaId}
              onClick={() => dispatch({ type: 'setActiveArea', areaId: area.id })}
              className="px-2 py-1 text-xs"
            >
              {area.name}
            </button>
          )}
          <AreaCodeInput areaId={area.id} areaName={area.name} code={area.code} />
          {renamingId !== area.id && (
            <button type="button" aria-label={`Rename ${area.name}`} onClick={() => startRename(area.id, area.name)} className="px-1 text-2xs">
              ✎
            </button>
          )}
          <button type="button" aria-label={`Move ${area.name} left`} disabled={index === 0} onClick={() => move(area.id, -1)} className="px-1 text-2xs disabled:opacity-30">
            ←
          </button>
          <button type="button" aria-label={`Move ${area.name} right`} disabled={index === areas.length - 1} onClick={() => move(area.id, 1)} className="px-1 text-2xs disabled:opacity-30">
            →
          </button>
          <button
            type="button"
            aria-label={onlyOneArea ? `Delete ${area.name} (disabled — this is the only area)` : `Delete ${area.name}`}
            disabled={onlyOneArea}
            onClick={() => setConfirmingDeleteId(area.id)}
            className="px-1 text-2xs text-destructive disabled:opacity-30"
          >
            ×
          </button>
        </div>
      ))}
      <button ref={addAreaButtonRef} type="button" aria-label="Add area" onClick={() => dispatch({ type: 'addArea', name: `Area ${areas.length}` })} className="rounded border border-stone-200 px-2 py-1 text-xs">
        +
      </button>

      {confirmingDeleteId && (
        <DeleteAreaDialog
          areaName={areas.find((a) => a.id === confirmingDeleteId)?.name ?? ''}
          onConfirm={() => {
            pendingDeleteFocusRef.current = true;
            dispatch({ type: 'deleteArea', areaId: confirmingDeleteId });
            setConfirmingDeleteId(null);
          }}
          onClose={() => setConfirmingDeleteId(null)}
        />
      )}
    </div>
  );
}

/** The area's code field, committing on blur/Enter rather than on every
 *  keystroke — found in the final review: dispatching on `onChange`
 *  pushed one undo-history entry per character typed. */
function AreaCodeInput({ areaId, areaName, code }: { areaId: string; areaName: string; code: string }) {
  const { dispatch } = useDrawingEditor();
  const [value, setValue] = useState(code);

  const commit = () => {
    if (value !== code) dispatch({ type: 'setAreaCode', areaId, code: value });
  };

  return (
    <input
      aria-label={`${areaName} code`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      placeholder="Code"
      className="w-14 rounded border border-stone-200 px-1 text-2xs"
    />
  );
}

function DeleteAreaDialog({ areaName, onConfirm, onClose }: {
  areaName: string; onConfirm: () => void; onClose: () => void;
}) {
  const contentRef = useModalDialog(onClose);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-area-dialog-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <h3 id="delete-area-dialog-title" className="text-sm font-bold text-stone-900">
          Delete {areaName}?
        </h3>
        <p className="mt-1 text-xs text-stone-500">Every piece in this area will be removed. This cannot be undone from here.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white">
            Delete area
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
