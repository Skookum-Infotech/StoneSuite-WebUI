// The Sketch / Cutout / Material switch in the middle of the top bar. Sketch is
// the drawing board; Cutout and Material each dock a panel on its right.

import type { EditorWorkspace } from './DrawingEditorContext';
import { useDrawingEditor } from './DrawingEditorContext';

import { buttonVariants } from '@/components/ui/button';
const TABS: Array<{ id: EditorWorkspace; label: string }> = [
  { id: 'sketch', label: 'Sketch' },
  { id: 'cutout', label: 'Cutout' },
  { id: 'material', label: 'Material' },
];

export function WorkspaceTabs() {
  const { workspace, setWorkspace } = useDrawingEditor();

  return (
    <div role="tablist" aria-label="Workspace" className="flex overflow-hidden rounded-md border border-stone-700 bg-stone-800">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={workspace === id}
          onClick={() => setWorkspace(id)}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
