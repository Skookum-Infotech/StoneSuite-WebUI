import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface PickerRole {
  id: string;
  name: string;
}

// Searchable multi-select for choosing which editable roles show as matrix
// columns — the matrix itself renders whatever role list it's given, so this
// is what keeps that list scannable once a tenant has more roles than fit on
// screen (see DashboardWidgetsPage's MATRIX_AUTO_SHOW_THRESHOLD). Pattern
// follows components/tenant/ApproverPicker.tsx.
export function RoleColumnPicker({
  roles,
  selectedIds,
  onChange,
  onReset,
}: {
  roles: PickerRole[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onReset: () => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roles
      .filter((r) => !selectedSet.has(r.id))
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [roles, selectedSet, query]);

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
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-2xs font-semibold text-stone-500">
          Comparing {selectedIds.length} of {roles.length} roles
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange(roles.map((r) => r.id))}
            className="text-2xs font-semibold text-brand-dark hover:underline"
          >
            Select all
          </button>
          <button type="button" onClick={onReset} className="text-2xs font-semibold text-stone-500 hover:underline">
            Reset
          </button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const role = byId.get(id);
            if (!role) return null;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 py-1 pl-2.5 pr-1 text-2xs font-semibold text-stone-700"
              >
                {role.name}
                <button
                  type="button"
                  aria-label={`Remove ${role.name} from the comparison`}
                  onClick={() => onChange(selectedIds.filter((sid) => sid !== id))}
                  className="rounded-full p-0.5 text-stone-400 transition hover:bg-stone-200 hover:text-stone-600"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div ref={containerRef} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          aria-label="Search roles to add to the comparison"
          placeholder="Add a role to compare…"
          className="h-8 w-full max-w-xs rounded-lg border border-stone-200 bg-white px-3 text-2xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/50"
        />
        {open && (
          <div className="absolute z-20 mt-1 w-full max-w-xs overflow-hidden rounded-xl border border-stone-200 bg-white shadow-md">
            {results.length === 0 ? (
              <p className="px-3 py-2 text-2xs text-stone-400">
                {roles.length === selectedIds.length ? 'Every role is already shown.' : 'No matching roles.'}
              </p>
            ) : (
              results.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => {
                    onChange([...selectedIds, role.id]);
                    setQuery('');
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-2xs font-medium text-stone-700 transition hover:bg-stone-50"
                >
                  {role.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
