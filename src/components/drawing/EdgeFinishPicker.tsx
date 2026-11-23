// The Finish (3D) choice in the edge editor: one card per finish, the picture
// above its name. It is recorded on the edge type for the 3D view still to come;
// nothing on the sketch changes with it.

import type { EdgeFinish } from '@/types/drawing';
import { EDGE_FINISHES } from '@/lib/drawing/edgeTypes';
import { EdgeFinishIcon } from './EdgeFinishIcon';

export function EdgeFinishPicker({ value, onChange }: { value: EdgeFinish; onChange: (finish: EdgeFinish) => void }) {
  return (
    <div role="radiogroup" aria-label="Finish (3D)" className="flex flex-wrap gap-2">
      {EDGE_FINISHES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          aria-label={label}
          onClick={() => onChange(id)}
          className="flex w-20 flex-col items-center gap-1 rounded-lg border border-stone-300 bg-white p-1.5 text-2xs font-semibold text-stone-700 outline-none hover:border-stone-500 focus-visible:ring-2 focus-visible:ring-brand/40 aria-checked:border-brand-dark aria-checked:bg-brand/10 aria-checked:text-stone-900"
        >
          <EdgeFinishIcon finish={id} className="h-12 w-12 rounded bg-white" />
          <span className="text-center leading-tight">{label}</span>
        </button>
      ))}
    </div>
  );
}
