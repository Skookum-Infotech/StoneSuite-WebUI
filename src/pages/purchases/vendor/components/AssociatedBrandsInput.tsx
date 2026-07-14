import { useState, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';

// Dynamic tag/badge input for "Associated Brands" — no shadcn multi-value
// component exists in this repo (see formUtils.ts convention), so this is a
// small controlled string[] input styled to match fieldCls/badge tokens used
// elsewhere (status badges, drawing type pills).
export function AssociatedBrandsInput({ value, onChange }: {
  value: string[];
  onChange: (brands: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const addBrand = () => {
    const trimmed = draft.trim();
    if (!trimmed || value.includes(trimmed)) {
      setDraft('');
      return;
    }
    onChange([...value, trimmed]);
    setDraft('');
  };

  const removeBrand = (brand: string) => onChange(value.filter((b) => b !== brand));

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addBrand();
    }
  };

  return (
    <div className="space-y-1.5">
      <label className={fieldLabelCls} htmlFor="associated-brands-input">Associated Brands</label>
      <div className="flex gap-2">
        <input
          id="associated-brands-input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a brand name and press Enter"
          className={fieldCls}
          aria-label="Add associated brand"
        />
        <button
          type="button"
          onClick={addBrand}
          disabled={!draft.trim()}
          aria-label="Add brand"
          className="inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 transition-all hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-3.5" />
          Add
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {value.map((brand) => (
            <span
              key={brand}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground ring-1 ring-accent-foreground/10"
            >
              {brand}
              <button
                type="button"
                onClick={() => removeBrand(brand)}
                aria-label={`Remove ${brand}`}
                className="rounded-full p-0.5 transition-colors hover:bg-accent-foreground/10"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
