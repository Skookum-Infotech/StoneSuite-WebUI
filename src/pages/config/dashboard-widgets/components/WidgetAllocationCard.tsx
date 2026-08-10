import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetDefinition, WidgetSize } from '@/types/dashboardWidgets';

const SIZE_LABELS: Record<WidgetSize, string> = {
  full: 'Full width',
  half: 'Half width',
  third: 'Third width',
};

export function WidgetAllocationCard({
  widget,
  roles,
  assignedRoleIds,
  onToggleRole,
  onToggleAll,
}: {
  widget: WidgetDefinition;
  roles: { id: string; name: string; locked: boolean }[];
  assignedRoleIds: string[];
  onToggleRole: (roleId: string, next: boolean) => void;
  onToggleAll: (next: boolean) => void;
}) {
  const editableRoles = roles.filter((r) => !r.locked);
  const allAssigned = editableRoles.length > 0 && editableRoles.every((r) => assignedRoleIds.includes(r.id));

  return (
    <div className="rounded-xl border border-stone-200 p-3.5">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-stone-900">{widget.title}</p>
          <p className="text-2xs text-stone-500">{widget.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="text-2xs text-stone-400">{SIZE_LABELS[widget.size]}</span>
          <button
            type="button"
            onClick={() => onToggleAll(!allAssigned)}
            disabled={editableRoles.length === 0}
            aria-label={`${allAssigned ? 'Clear' : 'Assign'} ${widget.title} for every role`}
            className="text-2xs font-semibold text-brand-dark hover:underline disabled:pointer-events-none disabled:text-stone-300"
          >
            {allAssigned ? 'Clear all' : 'Select all'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {roles.map((role) => {
          if (role.locked) {
            return (
              <span
                key={role.id}
                title={`${role.name} always has every widget`}
                className="inline-flex items-center gap-1 rounded-full bg-stone-800 px-2.5 py-1 text-2xs font-semibold text-white"
              >
                <Lock className="size-2.5" />
                {role.name}
              </span>
            );
          }
          const assigned = assignedRoleIds.includes(role.id);
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onToggleRole(role.id, !assigned)}
              aria-pressed={assigned}
              aria-label={`${assigned ? 'Remove' : 'Add'} ${role.name} ${assigned ? 'from' : 'to'} ${widget.title}`}
              className={cn(
                'rounded-full px-2.5 py-1 text-2xs font-semibold transition-colors',
                assigned
                  ? 'bg-brand-dark text-white hover:bg-stone-800'
                  : 'border border-dashed border-stone-300 text-stone-500 hover:border-brand-dark hover:text-brand-dark',
              )}
            >
              {assigned ? role.name : `+ ${role.name}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
