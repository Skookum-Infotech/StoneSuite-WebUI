import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { inventoryLookupService } from '@/services/inventoryLookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { fieldCls } from '@/components/crm/formUtils';
import { WRITABLE_LOOKUP_KINDS, type LookupItem, type LookupKind } from '@/types/inventory';

interface DraftRow {
  id?: number;
  name: string;
  code: string;
  isActive: boolean;
}

const emptyDraft: DraftRow = { name: '', code: '', isActive: true };

// Generic vocabulary admin table — materials, colors, finishes, reasons are
// writable here; units and tax-rates render read-only (they 400 on write —
// inventory/lookups.go's `writable` flag). `colors` ships empty by design, so
// this screen is the one place that gap gets filled tenant-side.
export function LookupVocabularyTable({ kind, label }: { kind: LookupKind; label: string }) {
  const queryClient = useQueryClient();
  const writable = WRITABLE_LOOKUP_KINDS.includes(kind);

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['inventory-lookup-admin', kind],
    queryFn: () => inventoryLookupService.list(kind, true),
  });

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<DraftRow>(emptyDraft);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-lookup-admin', kind] });
    queryClient.invalidateQueries({ queryKey: ['inventory-lookups'] });
  };

  const { mutate: save, isPending: saving, error: saveError } = useMutation({
    mutationFn: () => (editingId === 'new'
      ? inventoryLookupService.create(kind, { name: draft.name.trim(), code: draft.code.trim(), isActive: draft.isActive })
      : inventoryLookupService.update(kind, editingId as number, { name: draft.name.trim(), code: draft.code.trim(), isActive: draft.isActive })),
    onSuccess: () => { invalidate(); setEditingId(null); setDraft(emptyDraft); },
  });

  const { mutate: remove, error: removeError } = useMutation({
    mutationFn: (id: number) => inventoryLookupService.remove(kind, id),
    onSuccess: invalidate,
  });

  function startEdit(item: LookupItem) {
    setEditingId(item.id);
    setDraft({ id: item.id, name: item.name, code: item.code, isActive: item.isActive });
  }
  function startNew() {
    setEditingId('new');
    setDraft(emptyDraft);
  }
  function cancel() {
    setEditingId(null);
    setDraft(emptyDraft);
  }

  return (
    <div className="space-y-3">
      {!writable && <p className="text-xs text-stone-400">{label} is a read-only vocabulary — it can&apos;t be edited here.</p>}
      {(saveError || removeError) && <p className="text-xs text-destructive">{apiErrorMessage(saveError ?? removeError, `Failed to save ${label.toLowerCase()}.`)}</p>}
      {error && <p className="text-xs text-destructive">{apiErrorMessage(error, `Failed to load ${label.toLowerCase()}.`)}</p>}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-stone-200 bg-table-header">
            <tr>
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-stone-500">Name</th>
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-stone-500">Code</th>
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-stone-500">Status</th>
              {writable && <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-stone-500 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-400">Loading…</td></tr>
            ) : items.length === 0 && editingId !== 'new' ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-400">No {label.toLowerCase()} yet.</td></tr>
            ) : (
              items.map((item) => (
                editingId === item.id ? (
                  <EditRow key={item.id} draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} colSpanActions={writable} />
                ) : (
                  <tr key={item.id} className="hover:bg-accent/10 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-stone-800">{item.name}</td>
                    <td className="px-4 py-2.5 font-mono text-stone-500">{item.code}</td>
                    <td className="px-4 py-2.5">
                      <span className={item.isActive ? 'text-emerald-600 font-semibold' : 'text-stone-400'}>{item.isActive ? 'Active' : 'Inactive'}</span>
                    </td>
                    {writable && (
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!item.isSystem && (
                            <>
                              <button type="button" onClick={() => startEdit(item)} aria-label={`Edit ${item.name}`} className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-1.5 text-stone-500 hover:bg-accent hover:border-accent hover:text-accent-foreground transition-colors"><Pencil className="size-3.5" /></button>
                              <button type="button" onClick={() => remove(item.id)} aria-label={`Delete ${item.name}`} className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-1.5 text-stone-500 hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors"><Trash2 className="size-3.5" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              ))
            )}
            {editingId === 'new' && (
              <EditRow draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} colSpanActions={writable} />
            )}
          </tbody>
        </table>
      </div>

      {writable && editingId === null && (
        <button type="button" onClick={startNew} className="flex items-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-50">
          <Plus className="size-3.5" /> Add {label}
        </button>
      )}
    </div>
  );
}

function EditRow({ draft, setDraft, onSave, onCancel, saving, colSpanActions }: {
  draft: DraftRow;
  setDraft: (d: DraftRow) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  colSpanActions: boolean;
}) {
  return (
    <tr className="bg-accent/5">
      <td className="px-4 py-2">
        <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name" className={fieldCls} aria-label="Name" autoFocus />
      </td>
      <td className="px-4 py-2">
        <input type="text" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="Code" className={fieldCls} aria-label="Code" />
      </td>
      <td className="px-4 py-2">
        <label className="flex items-center gap-1.5 text-xs text-stone-600">
          <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} className="size-3.5 rounded border-stone-300 text-brand focus:ring-brand/30" />
          Active
        </label>
      </td>
      {colSpanActions && (
        <td className="px-4 py-2 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <button type="button" disabled={saving || !draft.name.trim() || !draft.code.trim()} onClick={onSave} aria-label="Save" className="inline-flex items-center justify-center rounded-lg bg-brand p-1.5 text-stone-950 hover:bg-brand-hover disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            </button>
            <button type="button" disabled={saving} onClick={onCancel} aria-label="Cancel" className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-1.5 text-stone-500 hover:bg-stone-50 transition-colors">
              <X className="size-3.5" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}
