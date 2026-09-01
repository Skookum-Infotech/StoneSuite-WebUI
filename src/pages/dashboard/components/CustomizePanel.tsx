import { X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useModalDialog } from '@/hooks/useModalDialog';
import type { WidgetDefinition } from '@/types/dashboardWidgets';

export function CustomizePanel({
  widgets,
  enabledIds,
  onToggle,
  onClose,
}: {
  widgets: WidgetDefinition[];
  enabledIds: string[];
  onToggle: (widgetId: string, next: boolean) => void;
  onClose: () => void;
}) {
  const contentRef = useModalDialog(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Customize dashboard widgets"
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">Customize dashboard</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Show or hide the widgets your admin has made available to you.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close customize panel"
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="size-4" />
          </button>
        </div>

        {widgets.length === 0 ? (
          <p className="text-xs text-stone-400">Your admin hasn&apos;t allocated any widgets to you yet.</p>
        ) : (
          <div className="max-h-[60vh] space-y-1 overflow-y-auto modal-scrollbar">
            {widgets.map((w) => {
              const enabled = enabledIds.includes(w.id);
              return (
                <label
                  key={w.id}
                  htmlFor={`widget-toggle-${w.id}`}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-stone-50"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-stone-900">{w.title}</span>
                    <span className="block text-2xs text-stone-500">{w.description}</span>
                  </span>
                  <Switch
                    id={`widget-toggle-${w.id}`}
                    checked={enabled}
                    onCheckedChange={(next) => onToggle(w.id, next)}
                    aria-label={`${enabled ? 'Hide' : 'Show'} ${w.title}`}
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
