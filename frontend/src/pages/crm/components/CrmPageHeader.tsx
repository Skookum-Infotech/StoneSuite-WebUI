import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft } from "lucide-react";

interface CrmPageHeaderProps {
  /** Label for the back breadcrumb button, e.g. "Leads" */
  backLabel: string;
  onBack: () => void;
  /** Lucide icon component for the entity type */
  icon: LucideIcon;
  /** @deprecated — icon color is now derived from the brand token system */
  iconBg?: string;
  /** @deprecated — icon color is now derived from the brand token system */
  iconColor?: string;
  /** Primary title — company name or "New Lead" */
  title: string;
  /** Entity label shown below the title ("Lead", "Prospect", "Customer") */
  subtitle?: string;
  /** Formatted record number from the API, e.g. "LD-0001" */
  recordNumber?: string;
  /** Status badge node (view/edit mode only) */
  statusBadge?: ReactNode;
  /** DeleteRecordDialog trigger — omit on create pages */
  deleteSlot?: ReactNode;
  /** Right-side action buttons (Save on edit pages; omit on view pages) */
  actions?: ReactNode;
}

export function CrmPageHeader({
  backLabel,
  onBack,
  icon: Icon,
  title,
  subtitle,
  recordNumber,
  statusBadge,
  deleteSlot,
  actions,
}: CrmPageHeaderProps) {
  return (
    <div className="shrink-0 bg-background border-b border-stone-200 3xl:px-10 4xl:px-14">

      {/* ── Mobile layout (< sm) — two rows ── */}
      <div className="sm:hidden">
        {/* Row 1: back + actions */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
          <button
            type="button"
            onClick={onBack}
            aria-label={`Back to ${backLabel}`}
            className="flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors py-1 pr-2 rounded-lg hover:bg-stone-100"
          >
            <ChevronLeft className="size-3.5 shrink-0" />
            {backLabel}
          </button>

          {/* Right-side: delete + save */}
          {(deleteSlot || actions) && (
            <div className="flex items-center gap-1.5">
              {deleteSlot && (
                <div className="[&>button]:text-2xs [&>button]:px-2 [&>button]:py-1 [&>button]:rounded-lg shrink-0">
                  {deleteSlot}
                </div>
              )}
              {actions && (
                <div className="[&>button]:text-2xs [&>button]:px-2.5 [&>button]:py-1 [&>button]:rounded-lg shrink-0">
                  {actions}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Row 2: icon + entity info */}
        <div className="flex items-center gap-2.5 px-3 pb-3">
          <div className="h-8 w-8 rounded-xl bg-accent flex items-center justify-center shrink-0 ring-1 ring-accent-foreground/10">
            <Icon className="h-3.5 w-3.5 text-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-sm font-bold tracking-tight text-stone-900 truncate max-w-[160px]">
                {title}
              </h1>
              {recordNumber && (
                <span className="font-mono text-2xs bg-stone-100 px-1.5 py-0.5 rounded text-stone-400 shrink-0">
                  {recordNumber}
                </span>
              )}
              {statusBadge}
            </div>
            {subtitle && (
              <p className="text-2xs text-stone-400 leading-relaxed mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Desktop layout (sm+) — single row (unchanged) ── */}
      <div className="hidden sm:flex items-center gap-3 px-5 py-4 3xl:py-5 4xl:py-6">
        {/* Entity icon */}
        <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center shrink-0 ring-1 ring-accent-foreground/10">
          <Icon className="h-4 w-4 text-accent-foreground" />
        </div>

        {/* Title block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-stone-900 truncate">
              {title}
            </h1>
            {recordNumber && (
              <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded-lg text-stone-400 shrink-0">
                {recordNumber}
              </span>
            )}
            {statusBadge}
          </div>
          {subtitle && (
            <p className="text-sm text-stone-500 leading-relaxed truncate">{subtitle}</p>
          )}
        </div>

        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          aria-label={`Back to ${backLabel}`}
          className="flex items-center gap-1 text-xs font-medium text-stone-400 hover:text-stone-700 transition-colors px-2 py-1.5 rounded-lg hover:bg-stone-100 shrink-0"
        >
          <ChevronLeft className="size-3.5" />
          Back
        </button>

        {/* Delete */}
        {deleteSlot && (
          <div className="shrink-0 [&>button]:text-xs [&>button]:px-2.5 [&>button]:rounded-lg">
            {deleteSlot}
          </div>
        )}

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
