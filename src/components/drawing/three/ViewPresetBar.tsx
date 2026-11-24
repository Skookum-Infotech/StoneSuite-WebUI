// The small bar of camera views along the bottom of the 3D view.

import { VIEW_PRESETS, type ViewPreset } from '@/lib/drawing/three/cameraViews';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
export function ViewPresetBar({ onPick, onSave }: { onPick: (preset: ViewPreset) => void; onSave: () => void }) {
  return (
    <div
      role="group"
      aria-label="Camera views"
      className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-lg bg-stone-900 p-1 shadow-lg"
    >
      {VIEW_PRESETS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-label={`${label} view`}
          onClick={() => onPick(id)}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        aria-label="Reset view"
        onClick={() => onPick('iso')}
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      >
        Reset
      </button>
      <button
        type="button"
        aria-label="Save view as PNG"
        title="Save this view as a PNG picture"
        onClick={onSave}
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'ml-1')}
      >
        Save PNG
      </button>
    </div>
  );
}
