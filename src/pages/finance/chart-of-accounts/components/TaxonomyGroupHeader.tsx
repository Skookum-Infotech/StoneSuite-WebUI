import { ChevronDown, ChevronRight, FolderPlus, Pencil, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A category or sub-category header row in the tree. `level` is what decides
 *  both the typography and which actions apply — only a category can hold
 *  sub-categories. */
export interface TaxonomyGroup {
  level: 'category' | 'subcategory';
  id: number;
  code: number;
  name: string;
}

export interface TaxonomyGroupActions {
  onToggle: (group: TaxonomyGroup) => void;
  onRename: (group: TaxonomyGroup) => void;
  onAddSubCategory: (group: TaxonomyGroup) => void;
  onAddAccount: (group: TaxonomyGroup) => void;
}

const LABEL_CLASSES: Record<TaxonomyGroup['level'], string> = {
  category: 'text-xs font-semibold text-stone-700',
  subcategory: 'text-2xs font-semibold uppercase tracking-wide text-stone-400',
};

const NOUN: Record<TaxonomyGroup['level'], string> = {
  category: 'category',
  subcategory: 'sub-category',
};

// The collapse control and the hover actions are siblings inside a plain
// <div>, not children of one <button>: a button inside a button is invalid
// HTML and leaves the inner controls unreachable by keyboard in several
// browsers, which is why these actions could not simply be dropped into the
// existing header markup.
export function TaxonomyGroupHeader({ group, collapsed, perms, actions }: {
  group: TaxonomyGroup;
  collapsed: boolean;
  perms: { canConfigure: boolean; canCreate: boolean };
  actions: TaxonomyGroupActions;
}) {
  const label = `${group.code} — ${group.name}`;
  const Chevron = collapsed ? ChevronRight : ChevronDown;

  return (
    <div className={cn(
      'group/header flex items-center gap-2 rounded-lg px-2 hover:bg-stone-50',
      group.level === 'category' ? 'py-1.5' : 'py-1',
    )}>
      <button
        type="button"
        onClick={() => actions.onToggle(group)}
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${label}`}
        className="flex flex-1 min-w-0 items-center gap-2 text-left"
      >
        <Chevron className="size-3.5 shrink-0 text-stone-400" />
        <span className={cn('truncate', LABEL_CLASSES[group.level])}>{label}</span>
      </button>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/header:opacity-100">
        {perms.canCreate && (
          <button
            type="button"
            onClick={() => actions.onAddAccount(group)}
            aria-label={`Add an account under ${label}`}
            title={`Add account under this ${NOUN[group.level]}`}
            className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            <Plus className="size-3.5" />
          </button>
        )}
        {perms.canConfigure && group.level === 'category' && (
          <button
            type="button"
            onClick={() => actions.onAddSubCategory(group)}
            aria-label={`Add a sub-category under ${label}`}
            title="Add sub-category"
            className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            <FolderPlus className="size-3.5" />
          </button>
        )}
        {perms.canConfigure && (
          <button
            type="button"
            onClick={() => actions.onRename(group)}
            aria-label={`Rename ${label}`}
            title={`Rename ${NOUN[group.level]}`}
            className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
