import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft } from "lucide-react";

interface CrmPageHeaderProps {
  /** Label for the back breadcrumb button, e.g. "Leads" */
  backLabel: string;
  onBack: () => void;
  /** Lucide icon component for the entity type */
  icon: LucideIcon;
  /** Tailwind bg class for the icon pill, e.g. 'bg-purple-100' */
  iconBg: string;
  /** Tailwind text class for the icon colour, e.g. 'text-purple-600' */
  iconColor: string;
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
  /** Right-side action buttons (Cancel+Save or Edit button) */
  actions: ReactNode;
}

export function CrmPageHeader({
  backLabel,
  onBack,
  icon: Icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  recordNumber,
  statusBadge,
  deleteSlot,
  actions,
}: CrmPageHeaderProps) {
  return (
    <div className="shrink-0 bg-white border-b border-stone-100 px-5 py-4 flex items-center gap-3">
      {/* Entity icon */}
      <div
        className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0 ring-1 ring-black/5`}
      >
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>

      {/* Title Block */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight text-stone-900 truncate">
            {title}
          </h1>
          {recordNumber && (
            <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded-md text-stone-400 shrink-0">
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
