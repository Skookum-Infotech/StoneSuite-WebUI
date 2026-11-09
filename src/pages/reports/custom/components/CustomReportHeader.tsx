import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CUSTOM_REPORT_NAME_MAX } from "@/types/customReports";

interface CustomReportHeaderProps {
  name: string;
  onNameChange: (name: string) => void;
  readOnly: boolean;
  /** e.g. "Shared by Sam Lee" for someone else's report. */
  note?: string;
  /** The action buttons. */
  children: ReactNode;
}

/** Back link, the report's name (editable by its owner), and its actions. */
export function CustomReportHeader({ name, onNameChange, readOnly, note, children }: CustomReportHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <Link
          to="/reports/custom"
          aria-label="Back to custom reports"
          className="inline-flex items-center gap-1 text-label text-stone-500 hover:text-stone-800"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Custom Reports
        </Link>
        <h1 className="sr-only">Custom report builder</h1>
        <Input
          aria-label="Report name"
          value={name}
          maxLength={CUSTOM_REPORT_NAME_MAX}
          disabled={readOnly}
          onChange={(e) => onNameChange(e.target.value)}
          className="mt-1 h-10 max-w-xl border-transparent bg-transparent px-1 text-xl font-bold tracking-tight text-stone-900 hover:border-stone-200"
        />
        {note && <p className="px-1 text-sm text-stone-500">{note}</p>}
      </div>
      {children}
    </div>
  );
}
