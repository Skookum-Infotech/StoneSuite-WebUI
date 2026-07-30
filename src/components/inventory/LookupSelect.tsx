import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { Plus, X, Loader2 } from 'lucide-react';
import { fieldCls } from '@/components/crm/formUtils';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryLookupService } from '@/services/inventoryLookupService';
import { WRITABLE_LOOKUP_KINDS, type LookupItem, type LookupKind } from '@/types/inventory';
import { cn } from '@/lib/utils';

// Generic vocabulary <select> shared by every inventory form (item, unit,
// bin, bundle, adjustment/transfer/count lines). `units` and `tax-rates`
// render read-only server-side vocabularies — no inline add is offered for
// them even if a caller passes allowInlineAdd, since the server 400s the
// write (see inventory/lookups.go's `writable` flag).
//
// `colors` ships empty by design (colour names are vendor-catalogue names —
// a seeded guess would collide with a tenant's real import), so the colour
// picker is the one place inline add is load-bearing rather than a
// convenience.
export function LookupSelect({
  kind, items, value, onChange, label, required, allowInlineAdd, onCreated, placeholder, className,
}: {
  kind: LookupKind;
  items: LookupItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  required?: boolean;
  allowInlineAdd?: boolean;
  onCreated?: (item: LookupItem) => void;
  placeholder?: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');

  const canInlineAdd = Boolean(allowInlineAdd) && WRITABLE_LOOKUP_KINDS.includes(kind);

  const { mutate: create, isPending, error } = useMutation({
    mutationFn: () => inventoryLookupService.create(kind, { name: newName.trim(), code: newCode.trim(), isActive: true }),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lookups'] });
      onChange(String(item.id));
      onCreated?.(item);
      setAdding(false);
      setNewName('');
      setNewCode('');
    },
  });

  if (adding) {
    return (
      <div className="space-y-1.5 rounded-lg border border-stone-200 bg-stone-50/60 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-semibold text-stone-500">New {label}</span>
          <button
            type="button"
            onClick={() => setAdding(false)}
            aria-label={`Cancel adding ${label}`}
            className="rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`${label} name`}
          aria-label={`New ${label} name`}
          className={fieldCls}
        />
        <input
          type="text"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          placeholder={`${label} code`}
          aria-label={`New ${label} code`}
          className={fieldCls}
        />
        {error && <p className="text-2xs text-red-600">{apiErrorMessage(error, `Failed to add ${label}.`)}</p>}
        <button
          type="button"
          disabled={!newName.trim() || !newCode.trim() || isPending}
          onClick={() => create()}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50 transition-colors"
        >
          {isPending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
          Add {label}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-label={label}
        className={cn(fieldCls, className)}
      >
        <option value="">{placeholder ?? `— Select ${label} —`}</option>
        {items.map((it) => (
          <option key={it.id} value={it.id}>{it.name}{it.code ? ` (${it.code})` : ''}</option>
        ))}
      </select>
      {canInlineAdd && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label={`Add ${label}`}
          title={`Add ${label}`}
          className="shrink-0 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-stone-500 hover:bg-accent hover:border-accent hover:text-accent-foreground transition-colors"
        >
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  );
}
