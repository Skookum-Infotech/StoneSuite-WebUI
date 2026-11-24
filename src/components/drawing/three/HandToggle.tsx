// The hand button at the right of the 3D view. Off, dragging turns the model round; on, dragging
// moves the view (grab and slide it), and the wheel zooms either way.

import { Hand } from 'lucide-react';

export function HandToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={active ? 'Hand tool on: drag moves the view' : 'Hand tool off: drag turns the view'}
      aria-pressed={active}
      title={active ? 'Hand on — drag to move the view, scroll to zoom' : 'Hand off — drag to turn the view, scroll to zoom'}
      onClick={onToggle}
      className="absolute right-3 top-3 z-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900 text-stone-200 shadow-lg hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand aria-pressed:bg-brand aria-pressed:text-stone-900"
    >
      <Hand className="size-5" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
