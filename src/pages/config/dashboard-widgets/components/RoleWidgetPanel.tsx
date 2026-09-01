import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toggleIds, resolvePresetWidgetIds, matchingPresetId } from '@/lib/dashboardWidgets';
import { WIDGET_PRESETS } from '@/config/dashboardWidgetPresets';
import { WIDGET_CATEGORY_ORDER, WIDGET_CATEGORY_LABELS } from '@/config/dashboardWidgets';
import type { WidgetDefinition } from '@/types/dashboardWidgets';
import { WidgetTile } from './WidgetTile';

const SIZE_CLASS: Record<WidgetDefinition['size'], string> = {
  full: 'col-span-12',
  half: 'col-span-12 sm:col-span-6',
  third: 'col-span-12 sm:col-span-4',
};

export function RoleWidgetPanel({
  role,
  catalog,
  allocatedIds,
  otherEditableRoles,
  onChange,
  onCopyFrom,
}: {
  role: { id: string; name: string; locked: boolean };
  catalog: WidgetDefinition[];
  allocatedIds: string[];
  otherEditableRoles: { id: string; name: string }[];
  onChange: (nextIds: string[]) => void;
  onCopyFrom: (sourceRoleId: string) => void;
}) {
  const activePresetId = matchingPresetId(allocatedIds, catalog, WIDGET_PRESETS);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-stone-900">{role.name}</h2>
          <p className="text-2xs text-stone-500">
            {role.locked
              ? 'Always has every widget — this role cannot be edited.'
              : `${allocatedIds.length} of ${catalog.length} widgets allocated.`}
          </p>
        </div>

        {!role.locked && otherEditableRoles.length > 0 && (
          <label className="flex items-center gap-1.5 text-2xs text-stone-500">
            Copy from
            <select
              aria-label={`Copy widget allocation into ${role.name} from another role`}
              value=""
              onChange={(e) => {
                if (e.target.value) onCopyFrom(e.target.value);
              }}
              className="h-8 rounded-md border border-stone-200 bg-white px-2 text-2xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="">Select a role…</option>
              {otherEditableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {role.locked && (
        <div className="flex items-center gap-2 rounded-lg bg-stone-800 px-3 py-2 text-2xs font-semibold text-white">
          <Lock className="size-3" aria-hidden="true" />
          {role.name} always has every widget
        </div>
      )}

      {!role.locked && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs text-stone-400">Presets</span>
          {WIDGET_PRESETS.map((preset) => {
            const active = preset.id === activePresetId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange(resolvePresetWidgetIds(preset, catalog))}
                aria-pressed={active}
                aria-label={`Apply the ${preset.label} preset to ${role.name}`}
                className={cn(
                  'rounded-full px-2.5 py-1 text-2xs font-semibold transition-colors',
                  active
                    ? 'bg-brand/20 text-brand-dark'
                    : 'border border-stone-200 text-stone-500 hover:border-brand-dark hover:text-brand-dark',
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-4">
        {WIDGET_CATEGORY_ORDER.map((category) => {
          const widgets = catalog.filter((w) => w.category === category);
          if (widgets.length === 0) return null;
          const categoryIds = widgets.map((w) => w.id);
          const onCount = categoryIds.filter((id) => allocatedIds.includes(id)).length;
          const allOn = onCount === categoryIds.length;

          return (
            <div key={category}>
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="text-2xs font-semibold uppercase tracking-[.09em] text-stone-500">
                  {WIDGET_CATEGORY_LABELS[category]}
                </h3>
                {role.locked ? (
                  <span className="text-2xs text-stone-400">
                    {categoryIds.length}/{categoryIds.length} on
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onChange(toggleIds(allocatedIds, categoryIds, !allOn))}
                    aria-label={`${allOn ? 'Clear' : 'Assign'} every ${WIDGET_CATEGORY_LABELS[category]} widget for ${role.name}`}
                    className="text-2xs font-semibold text-brand-dark hover:underline"
                  >
                    {allOn ? 'Clear all' : `${onCount}/${categoryIds.length} on`}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-12 gap-2">
                {widgets.map((widget) => (
                  <div key={widget.id} className={SIZE_CLASS[widget.size]}>
                    <WidgetTile
                      widget={widget}
                      checked={role.locked || allocatedIds.includes(widget.id)}
                      disabled={role.locked}
                      onToggle={(next) => onChange(toggleIds(allocatedIds, [widget.id], next))}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
