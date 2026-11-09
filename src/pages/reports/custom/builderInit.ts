import { emptyDefinition, pruneUnknownFields } from "@/lib/customReportDefinition";
import {
  CUSTOM_REPORT_NAME_MAX,
  type CatalogSource,
  type CustomReportDefinition,
  type CustomReportInterpretation,
  type SavedCustomReport,
} from "@/types/customReports";

export type BuilderInit =
  | {
      kind: "ready";
      source: CatalogSource;
      definition: CustomReportDefinition;
      name: string;
      shared: boolean;
      /** Fields a saved report named that the catalog no longer has. */
      removed: string[];
      /** What the assistant understood, when the report came from it. */
      note: { summary: string; dropped: string[] } | null;
    }
  | { kind: "no-access" }
  | { kind: "no-sources" };

export const UNTITLED_REPORT = "Untitled report";

/** Works out what the builder opens on: a saved report (minus anything the
 *  catalog no longer has), the assistant's interpretation, or an empty report
 *  on the first source the caller can use. */
export function initBuilder(
  catalog: CatalogSource[],
  report: SavedCustomReport | undefined,
  interpretation: CustomReportInterpretation | undefined,
): BuilderInit {
  if (report) {
    const source = catalog.find((s) => s.key === report.definition.source);
    if (!source) return { kind: "no-access" };
    const { definition, removed } = pruneUnknownFields(report.definition, source);
    return { kind: "ready", source, definition, name: report.name, shared: report.shared, removed, note: null };
  }
  const first = catalog[0];
  if (!first) return { kind: "no-sources" };

  const proposed = interpretation && catalog.find((s) => s.key === interpretation.definition.source);
  if (interpretation && proposed) {
    const { definition } = pruneUnknownFields(interpretation.definition, proposed);
    return {
      kind: "ready",
      source: proposed,
      definition,
      name: interpretation.summary.trim().slice(0, CUSTOM_REPORT_NAME_MAX) || UNTITLED_REPORT,
      shared: false,
      removed: [],
      note: { summary: interpretation.summary, dropped: interpretation.dropped },
    };
  }
  return { kind: "ready", source: first, definition: emptyDefinition(first), name: UNTITLED_REPORT, shared: false, removed: [], note: null };
}
