// The profile type dropdown in the Profiles bar: the picked type's colour and
// name, opening upward (the bar sits at the bottom of the board) onto the
// shop's list with "Add new" last. Same trigger + Popover look as
// EdgeTypePicker, which this mirrors field for field.

import { useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AttachedProfileType } from '@/types/drawing';
import { ColorSwatch } from './ColorSwatch';

const ROW_CLASS = 'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-ink outline-none transition-colors hover:bg-stone-100 focus-visible:bg-stone-100';

export function AttachedProfileTypePicker({ types, selected, onPick, onAdd }: {
  types: AttachedProfileType[];
  selected: AttachedProfileType | undefined;
  onPick: (id: string) => void;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  const step = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const rows = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button[data-row]') ?? []);
    if (rows.length === 0) return;
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? at + 1 : at - 1;
    rows[(next + rows.length) % rows.length].focus();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label="Profile type"
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex h-8 min-w-44 items-center gap-2 rounded-md border border-stone-600 bg-stone-800 px-2 text-left text-xs text-stone-100 hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          {selected && <ColorSwatch color={selected.color} />}
          <span className="flex-1 truncate">{selected?.name ?? 'No profile types'}</span>
          <ChevronDown className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-48 p-1"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const rows = list.current?.querySelectorAll<HTMLButtonElement>('button[data-row]');
          (list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]') ?? rows?.[0])?.focus();
        }}
      >
        <div ref={list} onKeyDown={step} onWheel={(e) => e.stopPropagation()} className="modal-scrollbar max-h-60 overflow-y-auto">
          <div role="listbox" aria-label="Profile type">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                role="option"
                data-row
                aria-selected={t.id === selected?.id}
                onClick={() => {
                  onPick(t.id);
                  setOpen(false);
                }}
                className={`${ROW_CLASS} aria-selected:bg-brand/10 aria-selected:font-medium aria-selected:text-ink-strong`}
              >
                <ColorSwatch color={t.color} />
                <span className="flex-1 truncate">{t.name}</span>
                {t.id === selected?.id && <Check className="size-3.5 shrink-0 text-link" aria-hidden="true" />}
              </button>
            ))}
          </div>
          <button
            type="button"
            data-row
            onClick={() => {
              setOpen(false);
              onAdd();
            }}
            className={`${ROW_CLASS} mt-1 border-t border-stone-100 font-medium text-ink-strong`}
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            <span>Add new</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
