// The strip at the bottom centre of the canvas while a Border, Corner or Edges
// tool is armed ("Applying Full Radius Out"): its title, a Close button, the row
// of styles to switch between (left out by a tool that has its own control), and
// — once something has been clicked — whatever the tool needs below (the
// measurements, or a note that it is already done).
// Mounted only while the tool is armed, which is also when Escape closes it.

import { useEffect, type ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';
const STYLE_BUTTON_CLASS = 'flex h-9 w-11 items-center justify-center rounded text-stone-200 hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand aria-pressed:bg-brand aria-pressed:text-ink-strong';

export interface ModeChoice {
  id: string;
  label: string;
  icon: ReactNode;
}

export function ToolModeBar({ name, title, choices, onClose, children }: {
  /** The bar's accessible name, e.g. "Border tool". */
  name: string;
  title: string;
  choices?: { items: ModeChoice[]; activeId: string; onPick: (id: string) => void };
  onClose: () => void;
  children?: ReactNode;
}) {
  // Esc closes the tool wherever focus is — the rail button that armed it
  // keeps focus, which is outside the canvas's own key handler.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="group"
      aria-label={name}
      className="pointer-events-auto absolute bottom-3 left-1/2 z-10 flex max-w-[95%] -translate-x-1/2 flex-col gap-2 rounded-lg bg-stone-900 px-3 py-2 shadow-lg"
    >
      <div className="flex items-center justify-between gap-6">
        <h3 className="text-white type-card-title">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className={buttonVariants({ size: 'sm' })}
        >
          Close (Esc)
        </button>
      </div>
      {choices && (
        <div className="flex gap-1 rounded-md border border-stone-700 p-0.5">
          {choices.items.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={choices.activeId === id}
              title={label}
              onClick={() => choices.onPick(id)}
              className={STYLE_BUTTON_CLASS}
            >
              {icon}
            </button>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
