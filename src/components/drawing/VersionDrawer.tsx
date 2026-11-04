// Version history drawer opened from DrawingToolbar's "Version history"
// button (build spec §5 Task 5): lists past saves, previews one, and
// restores it. Restoring always creates a NEW version — it never rewinds
// history, matching the backend's drawing.Restore. Same useModalDialog +
// createPortal shape as every other hand-rolled dialog in this feature.

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalDialog } from '@/hooks/useModalDialog';
import type { Drawing } from '@/types/drawing';
import { DrawingConflictError, drawingService, type VersionSummary } from '@/services/drawingService';

function formatUpdated(v: VersionSummary): string {
  return `Version ${v.version} — ${v.updatedBy.name || 'Unknown'}, ${new Date(v.updatedAt).toLocaleString()}`;
}

export function VersionDrawer({ salesOrderId, currentVersion, onRestored, onClose }: {
  salesOrderId: string; currentVersion: number; onRestored: (drawing: Drawing) => void; onClose: () => void;
}) {
  const contentRef = useModalDialog(onClose);
  const errorId = useId();
  const [items, setItems] = useState<VersionSummary[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [preview, setPreview] = useState<Drawing | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    drawingService.listVersions(salesOrderId).then((page) => setItems(page.items));
  }, [salesOrderId]);

  const selectVersion = (version: number) => {
    setSelectedVersion(version);
    setPreview(null);
    setError(null);
    drawingService.getVersion(salesOrderId, version).then(setPreview);
  };

  const restore = () => {
    if (selectedVersion === null) return;
    setRestoring(true);
    setError(null);
    drawingService
      .restoreVersion(salesOrderId, selectedVersion, currentVersion)
      .then((restored) => {
        setRestoring(false);
        onRestored(restored);
      })
      .catch((err: unknown) => {
        setRestoring(false);
        setError(err instanceof DrawingConflictError ? err.message : 'Failed to restore this version.');
      });
  };

  const pieceCount = preview ? preview.areas.reduce((sum, a) => sum + a.pieces.length, 0) : 0;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="version-drawer-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 flex max-h-[80vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <h3 id="version-drawer-title" className="text-sm font-bold text-stone-900">Version history</h3>

        <ul className="flex flex-col gap-1">
          {items.map((v) => (
            <li key={v.version}>
              <button
                type="button"
                aria-label={`View version ${v.version}`}
                aria-pressed={selectedVersion === v.version}
                onClick={() => selectVersion(v.version)}
                className="w-full rounded border border-stone-200 px-2 py-1 text-left text-xs"
              >
                {formatUpdated(v)}
              </button>
            </li>
          ))}
        </ul>

        {preview && (
          <div className="rounded border border-stone-200 p-2 text-xs text-stone-600">
            {preview.areas.length} area{preview.areas.length === 1 ? '' : 's'}, {pieceCount} piece{pieceCount === 1 ? '' : 's'}
          </div>
        )}

        {error && (
          <p id={errorId} role="alert" className="text-2xs text-destructive">{error}</p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600">
            Close
          </button>
          <button
            type="button"
            aria-label="Restore this version"
            disabled={selectedVersion === null || restoring}
            onClick={restore}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            Restore this version
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
