// The shape chooser the Cutout dialog's "Change" button opens. A type with
// more than one outline (fireplace: Arc | Rectangle; bathtub: Ellipse |
// Rectangle; other: Arc | Rectangle | Ellipse) gets a tab for each. Under a tab
// come "No Picture" — just that outline — and the pictures drawn in it.

import { useState } from 'react';
import type { CutoutType } from '@/types/drawing';
import { SHAPE_TABS, shapesForTab, tabsForType, type CutoutShapeDef, type ShapeTab } from '@/lib/drawing/cutoutShapes';
import { CutoutShapeThumb } from './CutoutShapeThumb';

export function CutoutShapePicker({ type, tab: currentTab, value, onPick, onBack }: {
  type: CutoutType; tab: ShapeTab; value: string; onPick: (tab: ShapeTab, code: string) => void; onBack: () => void;
}) {
  const tabs = tabsForType(type);
  const [tab, setTab] = useState<ShapeTab>(tabs.includes(currentTab) ? currentTab : tabs[0] ?? 'rectangle');
  const options: Array<{ code: string; name: string; shape: CutoutShapeDef | null }> = [
    { code: '', name: 'No Picture', shape: null },
    ...shapesForTab(type, tab).map((shape) => ({ code: shape.code, name: shape.name, shape })),
  ];

  return (
    <>
      <div className="modal-scrollbar overflow-y-auto px-4 py-3">
        <h3 className="mb-2 text-xs font-semibold text-stone-900">Choose a shape</h3>
        {tabs.length > 1 && (
          <div role="tablist" aria-label="Outline" className="mb-3 flex w-fit overflow-hidden rounded-md border border-stone-200 bg-stone-50">
            {tabs.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className="px-4 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 aria-selected:bg-brand aria-selected:text-stone-900"
              >
                {SHAPE_TABS[id].label}
              </button>
            ))}
          </div>
        )}
        <ul aria-label="Shapes" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {options.map(({ code, name, shape }) => (
            <li key={code || 'none'}>
              <button
                type="button"
                aria-label={name}
                aria-pressed={value === code && currentTab === tab}
                onClick={() => onPick(tab, code)}
                className="flex h-full w-full flex-col items-center gap-1 rounded border border-stone-200 bg-white p-2 text-center text-2xs text-stone-700 hover:bg-stone-50 aria-pressed:border-brand-dark aria-pressed:bg-brand/20"
              >
                <CutoutShapeThumb shape={shape} geometry={SHAPE_TABS[tab].geometry} className="h-16 w-full" />
                {name}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex justify-end border-t border-stone-200 px-4 py-3">
        <button type="button" onClick={onBack} className="rounded-lg border border-stone-300 bg-white px-4 py-1.5 text-xs font-medium text-stone-700">
          Back
        </button>
      </div>
    </>
  );
}
