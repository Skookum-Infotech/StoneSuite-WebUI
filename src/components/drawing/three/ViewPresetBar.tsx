// The small bar of camera views along the bottom of the 3D view.

import { VIEW_PRESETS, type ViewPreset } from '@/lib/drawing/three/cameraViews';

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
          className="rounded-md px-3 py-1 text-xs font-medium text-white hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-400"
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        aria-label="Reset view"
        onClick={() => onPick('iso')}
        className="rounded-md px-3 py-1 text-xs font-medium text-lime-300 hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-400"
      >
        Reset
      </button>
      <button
        type="button"
        aria-label="Save view as PNG"
        title="Save this view as a PNG picture"
        onClick={onSave}
        className="ml-1 rounded-md border-l border-stone-600 px-3 py-1 text-xs font-medium text-white hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-400"
      >
        Save PNG
      </button>
    </div>
  );
}
