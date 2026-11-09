import { Copy, Download, FileText, Save, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PRIMARY_BUTTON, SMALL_BUTTON } from "./builderStyles";

export interface ReportActionState {
  /** Not saved yet. */
  isNew: boolean;
  /** The caller owns the report (always true for a new one). */
  isMine: boolean;
  /** Holds custom_report:create, so can save, share, copy and delete. */
  canCreate: boolean;
  shared: boolean;
  /** A save, copy, delete or export is in flight. */
  busy: boolean;
  /** Nothing to export yet, or the report cannot run. */
  exportDisabled: boolean;
}

export interface ReportActionHandlers {
  onSharedChange: (shared: boolean) => void;
  onSave: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
}

interface ReportActionsProps {
  state: ReportActionState;
  handlers: ReportActionHandlers;
}

/** The builder's header buttons: Save, Share with workspace, Save a copy,
 *  Delete, and the two exports. What shows depends on who owns the report. */
export function ReportActions({ state, handlers }: ReportActionsProps) {
  const canEdit = state.isMine && state.canCreate;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <label className="inline-flex items-center gap-2 text-xs font-medium text-stone-700">
          <Switch
            aria-label="Share with workspace"
            checked={state.shared}
            disabled={state.busy}
            onCheckedChange={handlers.onSharedChange}
          />
          Share with workspace
        </label>
      )}
      {canEdit && (
        <button type="button" aria-label="Save report" disabled={state.busy} onClick={handlers.onSave} className={PRIMARY_BUTTON}>
          <Save className="size-3.5" aria-hidden="true" />
          Save
        </button>
      )}
      {!state.isNew && state.canCreate && (
        <button type="button" aria-label="Save a copy" disabled={state.busy} onClick={handlers.onCopy} className={SMALL_BUTTON}>
          <Copy className="size-3.5" aria-hidden="true" />
          Save a copy
        </button>
      )}
      {!state.isNew && canEdit && (
        <button type="button" aria-label="Delete report" disabled={state.busy} onClick={handlers.onDelete} className={SMALL_BUTTON}>
          <Trash2 className="size-3.5" aria-hidden="true" />
          Delete
        </button>
      )}
      <button
        type="button"
        aria-label="Export PDF"
        disabled={state.exportDisabled || state.busy}
        onClick={handlers.onExportPdf}
        className={SMALL_BUTTON}
      >
        <FileText className="size-3.5" aria-hidden="true" />
        Export PDF
      </button>
      <button
        type="button"
        aria-label="Download CSV"
        disabled={state.exportDisabled || state.busy}
        onClick={handlers.onExportCsv}
        className={SMALL_BUTTON}
      >
        <Download className="size-3.5" aria-hidden="true" />
        Download CSV
      </button>
    </div>
  );
}
