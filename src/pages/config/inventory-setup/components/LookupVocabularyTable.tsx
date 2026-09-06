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
  // Colors only — see the hex input in EditRow below. Kept on every draft
  // (not just colors') so EditRow's props stay uniform across vocabularies.
  hex: string;
}

const emptyDraft: DraftRow = { name: '', code: '', isActive: true, hex: '' };

// Mirrors inventory/lookups_store.go's colorHex regex so a bad swatch is
// caught in the form instead of round-tripping to the server for a 400.
const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

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

  // hex only actually applies to the 'colors' vocabulary server-side
  // (inventory/lookups.go's extraCols registry) -- sending it for any other
  // kind is a harmless no-op there, so it's simplest to always include it
  // rather than branch on kind here too.
  const { mutate: save, isPending: saving, error: saveError } = useMutation({
    mutationFn: () => (editingId === 'new'
      ? inventoryLookupService.create(kind, { name: draft.name.trim(), code: draft.code.trim(), isActive: draft.isActive, hex: draft.hex.trim() })
      : inventoryLookupService.update(kind, editingId as number, { name: draft.name.trim(), code: draft.code.trim(), isActive: draft.isActive, hex: draft.hex.trim() })),
    onSuccess: () => { invalidate(); setEditingId(null); setDraft(emptyDraft); },
  });

  const { mutate: remove, error: removeError } = useMutation({
    mutationFn: (id: number) => inventoryLookupService.remove(kind, id),
    onSuccess: invalidate,
  });

  function startEdit(item: LookupItem) {
    setEditingId(item.id);
    const hex = typeof item.extra?.hex === 'string' ? item.extra.hex : '';
    setDraft({ id: item.id, name: item.name, code: item.code, isActive: item.isActive, hex });
  }
  function startNew() {
    setEditingId('new');
    setDraft(emptyDraft);
  }
  function cancel() {
    setEditingId(null);
    setDraft(emptyDraft);
  }

  const isColors = kind === 'colors';
  const colCount = 3 + (isColors ? 1 : 0) + (writable ? 1 : 0);
  const hexInvalid = isColors && draft.hex !== '' && !HEX_PATTERN.test(draft.hex);

  return (
    <div className="space-y-3">
      {!writable && <p className="text-xs text-stone-400">{label} is a read-only vocabulary — it can&apos;t be edited here.</p>}
      {(saveError || removeError) && <p className="text-xs text-destructive">{apiErrorMessage(saveError ?? removeError, `Failed to save ${label.toLowerCase()}.`)}</p>}
      {error && <p className="text-xs text-destructive">{apiErrorMessage(error, `Failed to load ${label.toLowerCase()}.`)}</p>}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-stone-200 bg-table-header">
            <tr>
              {isColors && <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-stone-500">Swatch</th>}
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-stone-500">Name</th>
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-stone-500">Code</th>
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-stone-500">Status</th>
              {writable && <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-stone-500 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {isLoading ? (
              <tr><td colSpan={colCount} className="px-4 py-6 text-center text-stone-400">Loading…</td></tr>
            ) : items.length === 0 && editingId !== 'new' ? (
              <tr><td colSpan={colCount} className="px-4 py-6 text-center text-stone-400">No {label.toLowerCase()} yet.</td></tr>
            ) : (
              items.map((item) => {
                const itemHex = typeof item.extra?.hex === 'string' ? item.extra.hex : '';
                return editingId === item.id ? (
                  <EditRow
                    key={item.id}
                    draft={draft}
                    onChange={setDraft}
                    actions={{ onSave: save, onCancel: cancel, saving }}
                    colSpanActions={writable}
                    kind={kind}
                  />
                ) : (
                  <tr key={item.id} className="hover:bg-accent/10 transition-colors">
                    {isColors && (
                      <td className="px-4 py-2.5">
                        <span
                          className="inline-block size-4 rounded-full shadow-[0_0_0_1px_rgba(28,25,23,0.15)]"
                          style={{ backgroundColor: itemHex || undefined }}
                          aria-hidden="true"
                        />
                      </td>
                    )}
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
                );
              })
            )}
            {editingId === 'new' && (
              <EditRow
                draft={draft}
                onChange={setDraft}
                actions={{ onSave: save, onCancel: cancel, saving }}
                colSpanActions={writable}
                kind={kind}
              />
            )}
          </tbody>
        </table>
      </div>

      {writable && editingId === null && (
        <button type="button" onClick={startNew} className="flex items-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-50">
          <Plus className="size-3.5" /> Add {label}
        </button>
      )}
      {hexInvalid && <p className="text-xs text-destructive">Colour must be a hex value like #A1B2C3.</p>}
    </div>
  );
}

function EditRow({ draft, onChange, actions, colSpanActions, kind }: {
  draft: DraftRow;
  onChange: (d: DraftRow) => void;
  actions: { onSave: () => void; onCancel: () => void; saving: boolean };
  colSpanActions: boolean;
  kind: LookupKind;
}) {
  const { onSave, onCancel, saving } = actions;
  const isColors = kind === 'colors';
  const hexValid = draft.hex === '' || HEX_PATTERN.test(draft.hex);

  return (
    <tr className="bg-accent/5">
      {isColors && (
        <td className="px-4 py-2">
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={hexValid && draft.hex ? draft.hex : '#94a3b8'}
              onChange={(e) => onChange({ ...draft, hex: e.target.value })}
              aria-label="Swatch color picker"
              className="size-7 shrink-0 cursor-pointer rounded border border-stone-200 bg-white p-0.5"
            />
            <input
              type="text"
              value={draft.hex}
              onChange={(e) => onChange({ ...draft, hex: e.target.value })}
              placeholder="#A1B2C3"
              aria-label="Swatch hex value"
              aria-invalid={!hexValid}
              className={`${fieldCls} w-24 font-mono`}
            />
          </div>
        </td>
      )}
      <td className="px-4 py-2">
        <input type="text" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} placeholder="Name" className={fieldCls} aria-label="Name" autoFocus />
      </td>
      <td className="px-4 py-2">
        <input type="text" value={draft.code} onChange={(e) => onChange({ ...draft, code: e.target.value })} placeholder="Code" className={fieldCls} aria-label="Code" />
      </td>
      <td className="px-4 py-2">
        <label className="flex items-center gap-1.5 text-xs text-stone-600">
          <input type="checkbox" checked={draft.isActive} onChange={(e) => onChange({ ...draft, isActive: e.target.checked })} className="size-3.5 rounded border-stone-300 text-brand focus:ring-brand/30" />
          Active
        </label>
      </td>
      {colSpanActions && (
        <td className="px-4 py-2 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <button type="button" disabled={saving || !draft.name.trim() || !draft.code.trim() || !hexValid} onClick={onSave} aria-label="Save" className="inline-flex items-center justify-center rounded-lg bg-brand p-1.5 text-stone-950 hover:bg-brand-hover disabled:opacity-50 transition-colors">
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
