// The panel docked on the right of the board while the Cutout or Material tab
// is open. The chevron on its edge folds it away and goes back to Sketch.
// Material is a placeholder until its setup is built.

import { ChevronsRight } from 'lucide-react';
import { CutoutPanel } from './CutoutPanel';
import { useDrawingEditor } from './DrawingEditorContext';

export function WorkspacePanel() {
  const { workspace, setWorkspace } = useDrawingEditor();
  if (workspace === 'sketch') return null;
  const title = workspace === 'cutout' ? 'Cutouts' : 'Material';

  return (
    <aside aria-label={title} className="relative flex min-h-0 w-72 shrink-0 flex-col rounded-lg border border-stone-200 bg-white">
      <button
        type="button"
        aria-label={`Close ${title} panel`}
        title="Close panel"
        onClick={() => setWorkspace('sketch')}
        className="absolute -left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-stone-900 shadow"
      >
        <ChevronsRight className="h-4 w-4" aria-hidden="true" />
      </button>
      <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-semibold text-stone-900">{title}</h2>
      {workspace === 'cutout' ? (
        <CutoutPanel />
      ) : (
        <p className="mt-16 px-4 text-center text-xs text-stone-500">Material setup is coming soon.</p>
      )}
    </aside>
  );
}
