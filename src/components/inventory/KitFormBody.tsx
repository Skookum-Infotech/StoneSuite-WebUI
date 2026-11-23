import { useState } from 'react';
import { Boxes, Package, Trash2 } from 'lucide-react';
import { ModernSection, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { fieldCls, fieldLabelCls, checkboxLabelCls } from '@/components/crm/formUtils';
import { ItemPicker } from '@/components/inventory/ItemPicker';
import { cn } from '@/lib/utils';
import {
  addMember, removeMember, setMemberQuantity, type KitFormState,
} from '@/lib/inventoryKitForm';

/** Field layout shared by New Kit and Edit Kit: the kit's name and state, and
 *  the list of items it holds with the quantity each line gets by default. */
export function KitFormBody({ data, onChange }: {
  data: KitFormState;
  onChange: (next: KitFormState) => void;
}) {
  const [notice, setNotice] = useState('');

  function handlePick(item: Parameters<typeof addMember>[1] | null) {
    if (!item) return;
    const result = addMember(data, item);
    setNotice(result.added ? '' : `“${item.name}” is already in this kit.`);
    if (result.added) onChange(result.state);
  }

  return (
    <div className="space-y-2">
      <ModernSection title="Kit/Package Information" index={0}>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <ModernFieldShell label="Kit/Package Name" required>
            <input
              type="text"
              value={data.name}
              maxLength={100}
              onChange={(e) => onChange({ ...data, name: e.target.value })}
              placeholder="e.g. Kitchen"
              className={fieldCls}
              aria-label="Kit/Package Name"
              required
            />
          </ModernFieldShell>
          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="kit-is-active"
              checked={data.isActive}
              onChange={(e) => onChange({ ...data, isActive: e.target.checked })}
              className="size-4 rounded border-stone-300 text-brand focus:ring-brand/30"
            />
            <label htmlFor="kit-is-active" className={checkboxLabelCls}>Active</label>
          </div>
        </div>
        <label className={cn(fieldLabelCls, 'mt-4')}>Description</label>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          rows={2}
          placeholder="What this kit/package is for…"
          className={cn(fieldCls, 'h-auto resize-none mt-1.5')}
          aria-label="Description"
        />
      </ModernSection>

      <ModernSection title="Items in this kit/package" index={1}>
        <p className="mb-3 text-xs text-stone-500">
          Picking this kit/package on a document line adds each of these items, with the quantity shown. An inactive
          item is skipped.
        </p>

        <div className="max-w-md">
          <ItemPicker value={null} onChange={handlePick} />
        </div>
        {notice && <p role="status" className="mt-1.5 text-xs font-medium text-amber-700">{notice}</p>}

        {data.members.length === 0 ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-stone-200 px-4 py-6 text-sm text-stone-500">
            <Boxes className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
            No items yet. Search above to add the first one.
          </div>
        ) : (
          <ul aria-label="Items in this kit" className="mt-4 divide-y divide-stone-100 rounded-lg border border-stone-200">
            {data.members.map((m) => (
              <li key={m.itemId} className="flex items-center gap-3 px-3 py-2">
                <Package className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-stone-800">{m.name}</span>
                  <span className="block truncate font-mono text-2xs text-stone-500">
                    {m.sku}{!m.isActive && ' · Inactive'}
                  </span>
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={m.quantity}
                  onChange={(e) => onChange(setMemberQuantity(data, m.itemId, e.target.value))}
                  aria-label={`Quantity of ${m.name}`}
                  className={cn(fieldCls, 'w-24 text-right')}
                />
                <button
                  type="button"
                  onClick={() => onChange(removeMember(data, m.itemId))}
                  aria-label={`Remove ${m.name} from this kit`}
                  className="shrink-0 rounded p-1 text-stone-500 transition-colors hover:bg-stone-100 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </ModernSection>
    </div>
  );
}
