// The list that opens beside a rail button: a title ("Borders (B)") over the
// choices that tool offers. Picking one arms the tool with it. Escape or a
// press anywhere outside it closes it (and says which, so the rail can hand
// focus back to its button after Escape only).

import { useEffect, useRef, type ReactNode } from 'react';

export interface FlyoutItem {
  id: string;
  label: string;
  icon: ReactNode;
  active: boolean;
}

const ITEM_CLASS = 'flex w-full items-center gap-3 border-t border-stone-700 px-3 py-2 text-left text-sm text-stone-100 hover:bg-stone-700 focus-visible:bg-stone-700 focus-visible:outline-none aria-pressed:text-brand';

export function ToolFlyout({ title, items, onPick, onClose }: {
  title: string;
  items: FlyoutItem[];
  onPick: (id: string) => void;
  onClose: (reason: 'escape' | 'away') => void;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    root.current?.querySelector('button')?.focus();
  }, []);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.current?.parentElement?.contains(e.target)) onClose('away');
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose('escape');
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [onClose]);

  return (
    <div
      ref={root}
      role="menu"
      aria-label={title}
      className="absolute left-full top-0 z-40 ml-2 w-56 overflow-hidden rounded-lg bg-stone-800 shadow-xl"
    >
      <h3 className="px-3 py-2 text-sm font-semibold text-white">{title}</h3>
      {items.map(({ id, label, icon, active }) => (
        <button key={id} type="button" role="menuitem" aria-label={label} aria-pressed={active} onClick={() => onPick(id)} className={ITEM_CLASS}>
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}
