import { ChevronRight, ChevronDown, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Bin } from '@/types/inventory';

// Tailwind indentation steps (not inline px math) — up to 4 levels deep per
// the page's stated scope, capped so a 5th level doesn't run off the array.
const INDENT_CLASSES = ['pl-2', 'pl-8', 'pl-14', 'pl-20'] as const;

// One row of the bin tree navigator (spec §5) — path is the breadcrumb,
// unitCount/overCapacity are advisory badges only, never a block. Expand
// state is lifted to BinListPage's `collapsed` set so "Expand All/Collapse
// All" can act on the whole tree at once, mirroring the accounting-periods
// tree table.
export function BinTreeNode({ bin, depth, collapsed, onToggleGroup, canEdit, onEdit, onAddChild, onDelete }: {
  bin: Bin;
  depth: number;
  collapsed: ReadonlySet<string>;
  onToggleGroup: (id: string) => void;
  canEdit: boolean;
  onEdit: (bin: Bin) => void;
  onAddChild: (parent: Bin) => void;
  onDelete: (bin: Bin) => void;
}) {
  const hasChildren = Boolean(bin.children?.length);
  const expanded = !collapsed.has(bin.id);
  const indentClass = INDENT_CLASSES[Math.min(depth, INDENT_CLASSES.length - 1)];

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-2 rounded-lg py-1.5 pr-2 transition-colors hover:bg-stone-50',
          indentClass,
          depth === 0 && 'bg-stone-50/40',
        )}
      >
        <button
          type="button"
          onClick={() => onToggleGroup(bin.id)}
          disabled={!hasChildren}
          aria-expanded={hasChildren ? expanded : undefined}
          aria-label={hasChildren ? (expanded ? `Collapse ${bin.name}` : `Expand ${bin.name}`) : undefined}
          className="flex size-5 shrink-0 items-center justify-center text-stone-400 disabled:opacity-0"
        >
          {hasChildren && (expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />)}
        </button>
        <MapPin className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm text-stone-800">
          <span className={cn(depth === 0 ? 'font-semibold' : 'font-medium')}>{bin.name}</span>
          <span className="ml-1.5 font-mono text-2xs text-stone-400">{bin.code}</span>
        </span>
        <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-2xs font-semibold text-stone-500 capitalize">{bin.type}</span>
        {bin.unitCount > 0 && (
          <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-2xs font-semibold', bin.overCapacity ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500')}>
            {bin.unitCount}{bin.overCapacity ? ' · over capacity' : ''}
          </span>
        )}
        {!bin.isActive && <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-2xs font-semibold text-stone-400">Inactive</span>}
        {canEdit && (
          <div className="ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button type="button" onClick={() => onAddChild(bin)} aria-label={`Add child bin under ${bin.name}`} title="Add child bin" className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
              <Plus className="size-3.5" />
            </button>
            <button type="button" onClick={() => onEdit(bin)} aria-label={`Edit ${bin.name}`} title="Edit bin" className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
              <Pencil className="size-3.5" />
            </button>
            <button type="button" onClick={() => onDelete(bin)} aria-label={`Delete ${bin.name}`} title="Delete bin" className="rounded p-1 text-stone-400 hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      {hasChildren && expanded && bin.children!.map((child) => (
        <BinTreeNode
          key={child.id}
          bin={child}
          depth={depth + 1}
          collapsed={collapsed}
          onToggleGroup={onToggleGroup}
          canEdit={canEdit}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
