import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiErrorMessage } from "@/api/tenantClient";
import { UnsavedChangesPrompt } from "@/components/UnsavedChangesPrompt";
import { useCustomReportBuilder } from "@/hooks/useCustomReportBuilder";
import { useCustomReportRun } from "@/hooks/useCustomReportRun";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { runnableDefinition, saveableDefinition } from "@/lib/customReportDefinition";
import { customReportTable } from "@/lib/customReportTable";
import { exportReportCsv, exportReportPdf } from "@/lib/reportExport";
import { customReportsService } from "@/services/customReportsService";
import { useBreadcrumbStore } from "@/store/useBreadcrumbStore";
import { CUSTOM_EXPORT_ROW_LIMIT, type CatalogSource, type SavedCustomReport } from "@/types/customReports";
import type { BuilderInit } from "./builderInit";
import { UNTITLED_REPORT } from "./builderInit";
import { BuilderSettings } from "./components/BuilderSettings";
import { CustomReportHeader } from "./components/CustomReportHeader";
import { CustomReportPreview } from "./components/CustomReportPreview";
import { DeleteReportDialog } from "./components/DeleteReportDialog";
import { DescribeChangeBox } from "./components/DescribeChangeBox";
import { InterpretationNote } from "./components/InterpretationNote";
import { ReportActions } from "./components/ReportActions";

type ReadyInit = Extract<BuilderInit, { kind: "ready" }>;

interface CustomReportEditorProps {
  init: ReadyInit;
  catalog: CatalogSource[];
  /** The saved report being opened; absent for a new one. */
  report?: SavedCustomReport;
}

const LIST_PATH = "/reports/custom";
const LIST_KEY = ["custom-reports"];

/** The builder itself: settings on the left, live preview on the right, and the
 *  save / share / copy / delete / export actions above them. */
export function CustomReportEditor({ init, catalog, report }: CustomReportEditorProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useUserPermissions();
  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);

  const { definition, dispatch } = useCustomReportBuilder(init.definition);
  const [name, setName] = useState(init.name);
  const [shared, setShared] = useState(init.shared);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isNew = !report;
  const isMine = !report || report.isMine;
  const canCreate = hasPermission("custom_report", "create");
  const source = catalog.find((s) => s.key === definition.source) ?? init.source;

  const guard = useUnsavedChangesGuard({ name, shared, definition });
  const runnable = useMemo(() => runnableDefinition(definition, source, new Date()), [definition, source]);
  const query = useCustomReportRun(runnable);

  // Detail pages label their breadcrumb with the record's own name, never its id.
  useEffect(() => {
    if (!report) return;
    setLabel(report.id, report.name);
    return () => clearLabel(report.id);
  }, [report, setLabel, clearLabel]);

  // Saved in the form the server accepts (see saveableDefinition), so a report
  // that previews also saves.
  const input = { name: name.trim() || UNTITLED_REPORT, definition: saveableDefinition(definition, source, new Date()), shared };
  const finish = (message: string) => {
    toast.success(message);
    void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    guard.markClean();
  };

  const save = useMutation({
    mutationFn: () => (report ? customReportsService.update(report.id, input) : customReportsService.create(input)),
    onSuccess: (saved) => {
      finish("Report saved.");
      if (report) queryClient.setQueryData(["custom-report", saved.id], saved);
      else navigate(`${LIST_PATH}/${saved.id}`, { replace: true });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not save the report.")),
  });

  const copy = useMutation({
    mutationFn: () => customReportsService.copy((report as SavedCustomReport).id),
    onSuccess: (saved) => {
      finish("Copy saved.");
      navigate(`${LIST_PATH}/${saved.id}`);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not copy the report.")),
  });

  const remove = useMutation({
    mutationFn: () => customReportsService.remove((report as SavedCustomReport).id),
    onSuccess: () => {
      finish("Report deleted.");
      navigate(LIST_PATH);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Could not delete the report.")),
  });

  /** Re-runs at the export limit so the file holds more than the 500-row preview. */
  async function runExport(kind: "csv" | "pdf") {
    if (!runnable) return;
    setExporting(true);
    try {
      const result = await customReportsService.run(runnable, CUSTOM_EXPORT_ROW_LIMIT);
      const table = customReportTable(input.name, definition, source, result);
      if (kind === "csv") exportReportCsv(table);
      else await exportReportPdf(table);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not export the report."));
    } finally {
      setExporting(false);
    }
  }

  const busy = save.isPending || copy.isPending || remove.isPending || exporting;
  const removedNote =
    init.removed.length > 0
      ? `${init.removed.join(", ")} ${init.removed.length === 1 ? "is" : "are"} no longer available and ${init.removed.length === 1 ? "was" : "were"} removed from this report.`
      : null;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 3xl:p-10 4xl:p-14">
      <CustomReportHeader
        name={name}
        onNameChange={setName}
        readOnly={!isMine}
        note={report && !report.isMine ? `Shared by ${report.ownerName}` : undefined}
      >
        <ReportActions
          state={{ isNew, isMine, canCreate, shared, busy, exportDisabled: !runnable || Boolean(query.error) }}
          handlers={{
            onSharedChange: setShared,
            onSave: () => save.mutate(),
            onCopy: () => copy.mutate(),
            onDelete: () => setConfirmingDelete(true),
            onExportCsv: () => void runExport("csv"),
            onExportPdf: () => void runExport("pdf"),
          }}
        />
      </CustomReportHeader>
      {removedNote && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {removedNote}
        </p>
      )}
      {init.note && <InterpretationNote summary={init.note.summary} dropped={init.note.dropped} />}
      {isMine && (
        <DescribeChangeBox
          current={definition}
          onApply={(interpretation) => dispatch({ type: "replace", definition: interpretation.definition })}
          onUndo={(previous) => dispatch({ type: "replace", definition: previous })}
        />
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(18rem,1fr)_2fr]">
        <BuilderSettings sources={catalog} source={source} definition={definition} dispatch={dispatch} readOnly={!isMine} />
        <CustomReportPreview definition={definition} query={query} runnable={Boolean(runnable)} />
      </div>
      <UnsavedChangesPrompt guard={guard} />
      {confirmingDelete && (
        <DeleteReportDialog
          name={report?.name ?? name}
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
