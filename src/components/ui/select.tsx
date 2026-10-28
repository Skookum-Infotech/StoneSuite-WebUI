import {
  Children, Fragment, isValidElement, useMemo, useRef, useState,
  type ChangeEvent, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Drop-in replacement for the browser <select>: same props, same <option> /
// <optgroup> children, same onChange(e) contract (e.target.value) — rendered
// as the app's trigger + Popover list (the PhoneNumberInput / DatePicker
// look) with a slim scrollbar instead of the OS-default menu. Lists longer
// than SEARCH_THRESHOLD options get a search box.

const SEARCH_THRESHOLD = 8;
const LISTBOX_MAX_HEIGHT_CLS = 'max-h-60';

interface ParsedOption {
  value: string;
  label: string;
  disabled: boolean;
  group?: string;
}

function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return '';
}

function collectOptions(children: ReactNode, group?: string): ParsedOption[] {
  const out: ParsedOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; disabled?: boolean; label?: string }>(child)) return;
    if (child.type === Fragment) {
      out.push(...collectOptions(child.props.children, group));
    } else if (child.type === 'optgroup') {
      out.push(...collectOptions(child.props.children, child.props.label));
    } else if (child.type === 'option') {
      const label = nodeText(child.props.children);
      out.push({
        value: child.props.value !== undefined ? String(child.props.value) : label,
        label,
        disabled: Boolean(child.props.disabled),
        group,
      });
    }
  });
  return out;
}

type NativeSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'defaultValue' | 'multiple' | 'size'>;

export interface SelectProps extends NativeSelectProps {
  value?: string | number;
  defaultValue?: string | number;
}

export function Select({
  value, defaultValue, onChange, children, className, disabled, required, id, name, title,
  'aria-label': ariaLabel, 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy,
}: SelectProps) {
  const options = useMemo(() => collectOptions(children), [children]);
  const [inner, setInner] = useState(defaultValue !== undefined ? String(defaultValue) : (options[0]?.value ?? ''));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const current = value !== undefined ? String(value) : inner;
  const selected = options.find((o) => o.value === current);
  const isPlaceholder = !selected || selected.value === '';
  const searchable = options.length > SEARCH_THRESHOLD;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  function pick(next: string) {
    if (value === undefined) setInner(next);
    // Callers were written against a native <select>, so hand them an
    // event-shaped object carrying the same target.value / name.
    const target = { value: next, name: name ?? '' };
    onChange?.({ target, currentTarget: target, type: 'change' } as unknown as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    setQuery('');
  }

  function focusOption(step: 1 | -1, from: Element | null) {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ?? []);
    if (items.length === 0) return;
    const idx = from ? items.indexOf(from as HTMLButtonElement) : -1;
    const next = idx === -1 ? (step === 1 ? 0 : items.length - 1) : (idx + step + items.length) % items.length;
    items[next].focus();
  }

  function onListKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    focusOption(e.key === 'ArrowDown' ? 1 : -1, e.target instanceof Element ? e.target.closest('[role="option"]') : null);
  }

  return (
    <Popover open={open} onOpenChange={(next) => { if (!disabled) { setOpen(next); if (!next) setQuery(''); } }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          title={title}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-required={required || undefined}
          data-value={current}
          className={cn(
            'flex items-center justify-between gap-2 text-left',
            className,
            isPlaceholder && 'text-stone-500',
          )}
        >
          <span className="truncate">{selected?.label || ' '}</span>
          <ChevronDown className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-48 max-w-[min(28rem,90vw)] p-0"
        onOpenAutoFocus={(e) => {
          if (searchable) return;
          e.preventDefault();
          const target = listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
            ?? listRef.current?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)');
          target?.focus();
        }}
      >
        {searchable && (
          <div className="border-b border-stone-100 p-2">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onListKeyDown}
              placeholder="Search…"
              aria-label={`Search ${ariaLabel ?? 'options'}`}
              className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
        )}
        <div
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          onKeyDown={onListKeyDown}
          onWheel={(e) => e.stopPropagation()}
          className={cn(LISTBOX_MAX_HEIGHT_CLS, 'modal-scrollbar overflow-y-auto p-1')}
        >
          {filtered.length === 0 && <p className="px-2.5 py-2 text-xs text-stone-500">No matches</p>}
          {filtered.map((o, i) => {
            const header = o.group && o.group !== filtered[i - 1]?.group ? o.group : null;
            const isSelected = o.value === current;
            return (
              <Fragment key={`${o.group ?? ''}\u0000${o.value}`}>
                {header && (
                  <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-stone-400">{header}</p>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-value={o.value}
                  disabled={o.disabled}
                  onClick={() => pick(o.value)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-stone-700 outline-none transition-colors hover:bg-stone-100 focus-visible:bg-stone-100',
                    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
                    o.value === '' && 'text-stone-500',
                    isSelected && 'bg-brand/10 font-medium text-stone-900',
                  )}
                >
                  <span className="truncate">{o.label || ' '}</span>
                  {isSelected && <Check className="size-3.5 shrink-0 text-brand-dark" aria-hidden="true" />}
                </button>
              </Fragment>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
