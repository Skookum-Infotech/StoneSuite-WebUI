import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

export const MAX_APPROVERS = 2;

// Minimal shape ApproverPicker needs to render a candidate — satisfied
// structurally by WorkspaceUser (tenant users) as well as CRM employee
// lookups, which have no email so callers pass ''.
export interface ApproverCandidate {
  id: string;
  fullName: string;
  email: string;
}

// Searchable multi-select for choosing 0–MAX_APPROVERS active users/employees
// as document approvers. Selection and persistence are owned by the caller;
// this component is presentation-only.
export function ApproverPicker({
  users,
  selected,
  onAdd,
  onRemove,
  disabled,
}: {
  users: ApproverCandidate[];
  selected: string[];
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const atLimit = selected.length >= MAX_APPROVERS;

  const results = useMemo(() => {
    if (atLimit) return [];
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => !selected.includes(u.id))
      .filter((u) => !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [users, selected, query, atLimit]);

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
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const u = byId.get(id);
            const label = u ? u.fullName || u.email : 'Unknown user';
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 py-1 pl-2.5 pr-1 text-xs font-semibold text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
              >
                {label}
                <button
                  type="button"
                  aria-label={`Remove approver ${label}`}
                  onClick={() => onRemove(id)}
                  disabled={disabled}
                  className="rounded-full p-0.5 text-stone-400 transition hover:bg-stone-200 hover:text-stone-600 disabled:opacity-50"
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {atLimit ? (
        <p className="text-xs text-stone-400">
          Maximum of {MAX_APPROVERS} approvers selected. Remove one to add another.
        </p>
      ) : (
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
            aria-label="Search active users to add as an approver"
            placeholder="Search active users…"
            className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900"
          />
          {open && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-md dark:border-stone-700 dark:bg-stone-900">
              {results.length === 0 ? (
                <p className="px-3.5 py-2.5 text-xs text-stone-400">
                  {users.length === 0 ? 'No active users available.' : 'No matching users.'}
                </p>
              ) : (
                results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onAdd(u.id);
                      setQuery('');
                      setOpen(false);
                    }}
                    className="flex w-full flex-col items-start px-3.5 py-2 text-left text-xs transition hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    <span className="font-semibold text-stone-700 dark:text-stone-200">{u.fullName || u.email}</span>
                    <span className="text-stone-400">{u.email}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {selected.length === 0 && !atLimit && (
        <p className="text-2xs text-stone-400">No approver selected — records won't require sign-off.</p>
      )}
    </div>
  );
}
