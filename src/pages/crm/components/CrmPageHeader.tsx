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
  /** Right-side action buttons (Save on edit pages; omit on view pages — actions live in sidebar) */
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
    <div className="shrink-0 bg-background border-b border-stone-200 px-5 py-4 3xl:px-10 3xl:py-5 4xl:px-14 4xl:py-6 flex items-center gap-3">
      {/* Entity icon — always uses brand accent for consistency */}
      <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center shrink-0 ring-1 ring-accent-foreground/10">
        <Icon className="h-4 w-4 text-accent-foreground" />
      </div>

      {/* Title Block */}
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
          <p className="text-sm text-stone-500 leading-relaxed truncate">
            {subtitle}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onBack}
        aria-label={`Back to ${backLabel}`}
        className="flex items-center gap-1 text-xs font-medium text-stone-400 hover:text-stone-700 transition-colors px-2 py-1.5 rounded-lg hover:bg-stone-100 shrink-0"
      >
        <ChevronLeft className="size-3.5" />
        Back
      </button>

      {/* Delete (view / edit only) */}
      {deleteSlot && (
        <>
          <div className="shrink-0 [&>button]:text-xs [&>button]:px-2.5 [&>button]:rounded-lg">
            {deleteSlot}
          </div>
        </>
      )}

      {/* Right-side actions */}

      <div className="flex items-center gap-2 shrink-0">{actions}</div>
    </div>
  );
}
