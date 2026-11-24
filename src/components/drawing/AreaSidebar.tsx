// The Areas sidebar that opens from the bottom bar: pick the area to draw in,
// add more, rename, set a code, reorder, and delete (with confirm) — build
// spec Task 3's "Area: add, rename, set code, reorder, delete with confirm".
// The delete confirm follows DeleteRefundDialog.tsx's useModalDialog +
// createPortal pattern — this repo has no Dialog primitive, every dialog
// hand-rolls its own overlay and focus handling.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalDialog } from '@/hooks/useModalDialog';
import { useDrawingEditor } from './DrawingEditorContext';

const ROW_BUTTON_CLASS = 'rounded px-1.5 py-0.5 text-xs text-stone-300 hover:bg-stone-700 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent';

export function AreaSidebar({ onClose }: { onClose: () => void }) {
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
    <aside
      aria-label="Areas"
      onKeyDown={(e) => e.key === 'Escape' && !confirmingDeleteId && onClose()}
      className="flex h-96 max-h-[60dvh] w-72 flex-col overflow-hidden rounded-lg bg-stone-900 text-stone-100 shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-stone-700 px-3 py-2.5">
        <h3 className="text-sm font-semibold">Areas</h3>
        <div className="flex items-center gap-1.5">
          <button
            ref={addAreaButtonRef}
            type="button"
            aria-label="Add area"
            onClick={() => dispatch({ type: 'addArea', name: `Area ${areas.length + 1}` })}
            className="rounded border border-stone-600 px-2 py-1 text-xs font-medium hover:bg-stone-700"
          >
            + Area
          </button>
          <button type="button" aria-label="Close areas" onClick={onClose} className={ROW_BUTTON_CLASS}>
            ✕
          </button>
        </div>
      </div>

      <ul className="modal-scrollbar min-h-0 flex-1 overflow-y-auto">
        {areas.map((area, index) => {
          const active = area.id === state.activeAreaId;
          return (
            <li
              key={area.id}
              className={`flex flex-col gap-1.5 border-b border-stone-800 px-3 py-2 ${active ? 'bg-brand text-ink-strong' : ''}`}
            >
              <div className="flex items-center gap-1">
                {renamingId === area.id ? (
                  <input
                    autoFocus
                    aria-label={`Rename ${area.name}`}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(area.id)}
                    onKeyDown={(e) => e.key === 'Enter' && commitRename(area.id)}
                    className="min-w-0 flex-1 rounded border border-stone-300 px-1.5 py-0.5 text-sm text-ink-strong"
                  />
                ) : (
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => dispatch({ type: 'setActiveArea', areaId: area.id })}
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                  >
                    {area.name}
                  </button>
                )}
                {renamingId !== area.id && (
                  <button type="button" aria-label={`Rename ${area.name}`} onClick={() => startRename(area.id, area.name)} className={ROW_BUTTON_CLASS}>
                    ✎
                  </button>
                )}
                <button type="button" aria-label={`Move ${area.name} up`} disabled={index === 0} onClick={() => move(area.id, -1)} className={ROW_BUTTON_CLASS}>
                  ↑
                </button>
                <button type="button" aria-label={`Move ${area.name} down`} disabled={index === areas.length - 1} onClick={() => move(area.id, 1)} className={ROW_BUTTON_CLASS}>
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={onlyOneArea ? `Delete ${area.name} (disabled — this is the only area)` : `Delete ${area.name}`}
                  disabled={onlyOneArea}
                  onClick={() => setConfirmingDeleteId(area.id)}
                  className={`${ROW_BUTTON_CLASS} ${active ? '' : 'text-red-400 hover:text-red-300'}`}
                >
                  ×
                </button>
              </div>
              <AreaCodeInput areaId={area.id} areaName={area.name} code={area.code} />
            </li>
          );
        })}
      </ul>

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
    </aside>
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
      className="w-full rounded border border-stone-300 bg-white px-1.5 py-0.5 text-xs text-ink-strong"
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
        <h3 id="delete-area-dialog-title" className="text-sm font-bold text-ink-strong">
          Delete {areaName}?
        </h3>
        <p className="mt-1 text-xs text-ink-muted">Every piece in this area will be removed. This cannot be undone from here.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-ink">
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
