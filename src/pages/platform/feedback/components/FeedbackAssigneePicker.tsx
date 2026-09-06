import { useEffect, useMemo, useRef, useState } from 'react';
import { User, UserX } from 'lucide-react';
import type { AssigneeCandidate } from '@/lib/feedback';

interface Props {
  candidates: AssigneeCandidate[];
  selectedId?: string;
  selectedName?: string;
  onSelect: (userId: string) => void;
  onUnassign: () => void;
  disabled?: boolean;
}

// Single-select searchable combobox for reassigning a feedback ticket to any
// admin in `candidates` — the sidebar's replacement for the old "Assign to
// me" / "Unassign" button pair. Interaction pattern (input + filtered
// dropdown + outside-click close) mirrors ApproverPicker, simplified to one
// selection instead of a multi-select chip list.
export function FeedbackAssigneePicker({ candidates, selectedId, selectedName, onSelect, onUnassign, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const currentName = (selectedId && byId.get(selectedId)?.name) || selectedName;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .filter((c) => c.id !== selectedId)
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [candidates, selectedId, query]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
        <User className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        {currentName || 'Unassigned'}
        {selectedId && (
          <button
            type="button"
            onClick={onUnassign}
            disabled={disabled}
            aria-label="Unassign ticket"
            className="ml-auto rounded-full p-0.5 text-stone-400 transition hover:bg-stone-200 hover:text-stone-600 disabled:opacity-50 dark:hover:bg-white/10"
          >
            <UserX className="size-3.5" />
          </button>
        )}
      </div>

      <div ref={containerRef} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          aria-label="Search admins to assign this ticket to"
          placeholder="Assign to…"
          className="h-8 w-full rounded-lg border border-stone-200 bg-white px-2.5 text-2xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-stone-200"
        />
        {open && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-md dark:border-white/10 dark:bg-stone-900">
            {results.length === 0 ? (
              <p className="px-3.5 py-2.5 text-2xs text-stone-400">
                {candidates.length === 0 ? 'No prior assignees available.' : 'No matching admins.'}
              </p>
            ) : (
              results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelect(c.id);
                    setQuery('');
                    setOpen(false);
                  }}
                  className="block w-full px-3.5 py-2 text-left text-2xs font-medium text-stone-700 transition hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-white/[0.06]"
                >
                  {c.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
