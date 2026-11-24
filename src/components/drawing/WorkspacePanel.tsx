// The panel docked on the right of the board while the Cutout or Material tab is open. It is
// flush: it runs the full height between the top bar and the status bar, touching both, with a
// plain header (title and a close button) above its body. Closing it goes back to Sketch.
// Material holds the slabs the order is cut from, so its panel is wider than Cutouts.

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CutoutPanel } from './CutoutPanel';
import { useDrawingEditor } from './DrawingEditorContext';
import { MaterialPanel } from './MaterialPanel';

export function WorkspacePanel() {
  const { workspace, setWorkspace } = useDrawingEditor();
  if (workspace === 'sketch') return null;
  const title = workspace === 'cutout' ? 'Cutouts' : 'Material';

  return (
    <aside
      aria-label={title}
      className={cn(
        'flex min-h-0 shrink-0 flex-col border-l border-stone-300 bg-white',
        workspace === 'material' ? 'w-[30rem]' : 'w-80',
      )}
    >
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-stone-200 bg-stone-100 pl-4 pr-2">
        <h2 className="type-card-title">{title}</h2>
        <button
          type="button"
          aria-label={`Close ${title} panel`}
          title="Close panel"
          onClick={() => setWorkspace('sketch')}
          className="flex h-7 w-7 items-center justify-center rounded text-ink hover:bg-stone-200 hover:text-ink-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      {workspace === 'cutout' ? <CutoutPanel /> : <MaterialPanel />}
    </aside>
  );
}
