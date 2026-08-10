import { Lock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { WIDGET_CATEGORY_ORDER, WIDGET_CATEGORY_LABELS } from '@/config/dashboardWidgets';
import type { WidgetDefinition } from '@/types/dashboardWidgets';

interface MatrixRole {
  id: string;
  name: string;
  locked: boolean;
}

export function WidgetAllocationMatrix({
  catalog,
  roles,
  allocatedIdsByRole,
  onToggleCell,
  onToggleWidgetForAllRoles,
  onToggleCategoryForRole,
}: {
  catalog: WidgetDefinition[];
  roles: MatrixRole[];
  allocatedIdsByRole: Record<string, string[]>;
  onToggleCell: (roleId: string, widgetId: string, next: boolean) => void;
  onToggleWidgetForAllRoles: (widgetId: string, next: boolean) => void;
  onToggleCategoryForRole: (roleId: string, widgetIds: string[], next: boolean) => void;
}) {
  const editableRoles = roles.filter((r) => !r.locked);
  const orderedRoles = [...editableRoles, ...roles.filter((r) => r.locked)];

  function isChecked(role: MatrixRole, widgetId: string): boolean {
    return role.locked || (allocatedIdsByRole[role.id] ?? []).includes(widgetId);
  }

  return (
    <div className="space-y-4">
      {WIDGET_CATEGORY_ORDER.map((category) => {
        const widgets = catalog.filter((w) => w.category === category);
        if (widgets.length === 0) return null;
        const categoryIds = widgets.map((w) => w.id);
        const categoryLabel = WIDGET_CATEGORY_LABELS[category];

        return (
          <div key={category} className="overflow-hidden rounded-xl border border-stone-200">
            <div className="border-b border-stone-200 bg-stone-50/70 px-4 py-2">
              <h3 className="text-2xs font-bold uppercase tracking-widest text-stone-500">{categoryLabel}</h3>
            </div>
            <div className="overflow-x-auto modal-scrollbar">
              <table className="w-full table-fixed text-xs">
                <colgroup>
                  <col className="w-48" />
                  {orderedRoles.map((role) => (
                    <col key={role.id} className="w-24" />
                  ))}
                </colgroup>
                <thead>
                  <tr className="border-b border-stone-100 bg-white">
                    <th className="sticky left-0 z-10 bg-white py-2 pl-4 pr-3 text-left text-2xs font-bold uppercase tracking-widest text-stone-400">
                      Widget
                    </th>
                    {orderedRoles.map((role) => {
                      const allOn = role.locked || categoryIds.every((id) => isChecked(role, id));
                      return (
                        <th key={role.id} className="px-2 py-2 text-center">
                          {role.locked ? (
                            <span
                              className="inline-flex items-center justify-center gap-1 text-2xs font-bold text-stone-400"
                              title={`${role.name} always has every widget`}
                            >
                              <Lock className="size-2.5" aria-hidden="true" />
                              {role.name}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onToggleCategoryForRole(role.id, categoryIds, !allOn)}
                              aria-label={`${allOn ? 'Clear' : 'Assign'} every ${categoryLabel} widget for ${role.name}`}
                              className={cn(
                                'mx-auto flex items-center justify-center rounded px-1.5 py-1 text-2xs font-bold transition',
                                allOn
                                  ? 'bg-brand/15 text-brand-dark hover:bg-brand/25'
                                  : 'text-stone-500 hover:bg-stone-100',
                              )}
                            >
                              {role.name}
                            </button>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {widgets.map((widget) => {
                    const allRolesOn = editableRoles.every((r) => isChecked(r, widget.id));
                    return (
                      <tr key={widget.id} className="border-t border-stone-50 hover:bg-stone-50/60">
                        <td className="sticky left-0 z-10 bg-inherit py-2.5 pl-4 pr-3">
                          <button
                            type="button"
                            onClick={() => onToggleWidgetForAllRoles(widget.id, !allRolesOn)}
                            className="block truncate text-left transition hover:opacity-70"
                            title={allRolesOn ? 'Clear widget for every role' : 'Grant widget to every role'}
                          >
                            <p className="truncate text-xs font-semibold text-stone-700">{widget.title}</p>
                          </button>
                        </td>
                        {orderedRoles.map((role) => (
                          <td key={role.id} className="py-2.5 text-center">
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={isChecked(role, widget.id)}
                                disabled={role.locked}
                                onCheckedChange={() => onToggleCell(role.id, widget.id, !isChecked(role, widget.id))}
                                aria-label={`${widget.title} for ${role.name}`}
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
