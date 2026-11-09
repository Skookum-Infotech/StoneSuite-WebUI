import { tenantClient } from '@/api/tenantClient';
import type {
  CatalogSource,
  CustomReportDefinition,
  CustomReportInput,
  CustomReportInterpretation,
  CustomReportResult,
  SavedCustomReport,
} from '@/types/customReports';

const BASE = '/tenant/reports/custom';

interface CatalogWire {
  success: boolean;
  sources: CatalogSource[] | null;
}

interface RunWire {
  success: boolean;
  result: CustomReportResult;
}

interface ListWire {
  success: boolean;
  reports: SavedCustomReport[] | null;
}

interface ReportWire {
  success: boolean;
  report: SavedCustomReport;
}

interface InterpretWire {
  success: boolean;
  interpretation: CustomReportInterpretation;
}

/** The server stores whatever definition it was sent; null lists (from a
 *  hand-edited or older row) become empty ones so the builder never has to
 *  guard against them. */
function normalizeDefinition(def: CustomReportDefinition): CustomReportDefinition {
  return { ...def, columns: def.columns ?? [], filters: def.filters ?? [], totals: def.totals ?? [] };
}

function toReport(wire: ReportWire): SavedCustomReport {
  return { ...wire.report, definition: normalizeDefinition(wire.report.definition) };
}

export const customReportsService = {
  /** The sources and fields the signed-in user may build reports on. */
  catalog: (): Promise<CatalogSource[]> =>
    tenantClient.get<CatalogWire>(`${BASE}/catalog`).then((r) => r.data.sources ?? []),

  /** Runs a definition for the caller's own scope. `limit` defaults to the
   *  preview limit server-side; exports ask for more. */
  run: (definition: CustomReportDefinition, limit?: number, signal?: AbortSignal): Promise<CustomReportResult> => {
    const body = limit === undefined ? { definition } : { definition, limit };
    const request = signal
      ? tenantClient.post<RunWire>(`${BASE}/run`, body, { signal })
      : tenantClient.post<RunWire>(`${BASE}/run`, body);
    return request.then((r) => r.data.result);
  },

  /** The caller's own reports first, then everyone's shared ones. */
  list: (): Promise<SavedCustomReport[]> =>
    tenantClient.get<ListWire>(BASE).then((r) =>
      (r.data.reports ?? []).map((report) => ({ ...report, definition: normalizeDefinition(report.definition) })),
    ),

  get: (id: string): Promise<SavedCustomReport> => tenantClient.get<ReportWire>(`${BASE}/${id}`).then((r) => toReport(r.data)),

  create: (input: CustomReportInput): Promise<SavedCustomReport> =>
    tenantClient.post<ReportWire>(BASE, input).then((r) => toReport(r.data)),

  update: (id: string, input: CustomReportInput): Promise<SavedCustomReport> =>
    tenantClient.put<ReportWire>(`${BASE}/${id}`, input).then((r) => toReport(r.data)),

  remove: (id: string): Promise<void> => tenantClient.delete(`${BASE}/${id}`).then(() => undefined),

  /** A private copy of a report the caller can see. */
  copy: (id: string): Promise<SavedCustomReport> =>
    tenantClient.post<ReportWire>(`${BASE}/${id}/copy`).then((r) => toReport(r.data)),

  /** Plain English in, a report definition out. `current` makes it an edit of
   *  the open report rather than a new one. */
  interpret: (prompt: string, current?: CustomReportDefinition): Promise<CustomReportInterpretation> => {
    const body = current ? { prompt, current } : { prompt };
    return tenantClient.post<InterpretWire>(`${BASE}/interpret`, body).then((r) => ({
      ...r.data.interpretation,
      definition: normalizeDefinition(r.data.interpretation.definition),
    }));
  },
};
