import { useState } from 'react';
import { ChevronRight, ChevronDown, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Bin } from '@/types/inventory';

// One row of the bin tree navigator (spec §5) — path is the breadcrumb,
// unitCount/overCapacity are advisory badges only, never a block.
export function BinTreeNode({ bin, depth, canEdit, onEdit, onAddChild, onDelete }: {
  bin: Bin;
  depth: number;
  canEdit: boolean;
  onEdit: (bin: Bin) => void;
  onAddChild: (parent: Bin) => void;
  onDelete: (bin: Bin) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = Boolean(bin.children?.length);

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-stone-50 transition-colors"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          disabled={!hasChildren}
          aria-label={hasChildren ? (expanded ? `Collapse ${bin.name}` : `Expand ${bin.name}`) : undefined}
          className="shrink-0 size-5 flex items-center justify-center text-stone-400 disabled:opacity-0"
        >
          {hasChildren && (expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />)}
        </button>
        <MapPin className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm text-stone-800">
          <span className="font-medium">{bin.name}</span>
          <span className="ml-1.5 font-mono text-2xs text-stone-400">{bin.code}</span>
        </span>
        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-2xs font-semibold text-stone-500 capitalize">{bin.type}</span>
        {bin.unitCount > 0 && (
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold', bin.overCapacity ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500')}>
            {bin.unitCount}{bin.overCapacity ? ' · over capacity' : ''}
          </span>
        )}
        {!bin.isActive && <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-2xs font-semibold text-stone-400">Inactive</span>}
        {canEdit && (
          <div className="ml-auto flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" onClick={() => onAddChild(bin)} aria-label={`Add child bin under ${bin.name}`} title="Add child bin" className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
              <Plus className="size-3.5" />
            </button>
            <button type="button" onClick={() => onEdit(bin)} aria-label={`Edit ${bin.name}`} title="Edit bin" className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
              <Pencil className="size-3.5" />
            </button>
            <button type="button" onClick={() => onDelete(bin)} aria-label={`Delete ${bin.name}`} title="Delete bin" className="rounded p-1 text-stone-400 hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      {hasChildren && expanded && bin.children!.map((child) => (
        <BinTreeNode key={child.id} bin={child} depth={depth + 1} canEdit={canEdit} onEdit={onEdit} onAddChild={onAddChild} onDelete={onDelete} />
      ))}
    </div>
  );
}
