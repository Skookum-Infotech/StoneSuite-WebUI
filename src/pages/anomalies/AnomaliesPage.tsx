import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { anomalyService } from "@/services/anomalyService";
import { apiErrorMessage } from "@/api/tenantClient";
import {
  ANOMALY_FILTERS,
  ANOMALY_FILTER_DOT_CLASSES,
  ANOMALY_SEVERITY_DOT_CLASSES,
  ANOMALY_SEVERITY_FILTERS,
  ANOMALY_STATUS_LABELS,
  buildAnomalyParams,
  filterBySeverity,
  sortAnomalies,
  type AnomalySeverityFilter,
} from "@/lib/anomaly";
import { cn } from "@/lib/utils";
import type { AnomalyFilter, AnomalyStatus } from "@/types/anomaly";
import { AnomalyRow } from "./components/AnomalyRow";
import { AnomalyScanSwitch } from "./components/AnomalyScanSwitch";

const QUERY_KEY = "anomalies";

interface ReviewVars {
  id: string;
  status: AnomalyStatus;
  note: string;
}

export default function AnomaliesPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<AnomalyFilter>("open");
  const [severity, setSeverity] = useState<AnomalySeverityFilter>("all");

  // Cursor-stack pagination (same shape as AuditLogPage): `cursor` is what the
  // current request sends ('' = first page), `prevCursors` is the LIFO stack
  // for walking back. Cursors are stored and replayed, never built or decoded.
  const [cursor, setCursor] = useState("");
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  const params = useMemo(
    () => buildAnomalyParams(filter, cursor),
    [filter, cursor],
  );

  const listQ = useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => anomalyService.list(params),
    placeholderData: (prev) => prev,
  });

  const review = useMutation({
    mutationFn: ({ id, status, note }: ReviewVars) =>
      anomalyService.review(id, status, note),
    onSuccess: (item) => {
      toast.success(
        `Marked as ${ANOMALY_STATUS_LABELS[item.status].toLowerCase()}`,
      );
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err) =>
      toast.error(apiErrorMessage(err, "Could not update this anomaly.")),
  });

  function changeFilter(next: AnomalyFilter) {
    setFilter(next);
    setCursor("");
    setPrevCursors([]);
  }

  const items = useMemo(
    () => sortAnomalies(filterBySeverity(listQ.data?.items ?? [], severity)),
    [listQ.data, severity],
  );
  const nextCursor = listQ.data?.nextCursor ?? "";

  function goNext() {
    if (!nextCursor) return;
    setPrevCursors((p) => [...p, cursor]);
    setCursor(nextCursor);
  }

  function goPrev() {
    const prev = prevCursors[prevCursors.length - 1] ?? "";
    setPrevCursors((p) => p.slice(0, -1));
    setCursor(prev);
  }

  return (
    <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
          <ShieldAlert className="size-5 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">
            Anomalies
          </h1>
          <p className="text-sm text-stone-500">
            Things that look wrong, sent to the people who can act on them.
            Review each one, then confirm, dismiss or note it.
          </p>
        </div>
        <AnomalyScanSwitch />
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-3 min-h-0 border-t border-stone-100 pt-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div
            role="tablist"
            aria-label="Filter by status"
            className="flex flex-wrap gap-1"
          >
            {ANOMALY_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => changeFilter(f.value)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400",
                  filter === f.value
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 rounded-full",
                    ANOMALY_FILTER_DOT_CLASSES[f.value],
                  )}
                />
                {f.label}
              </button>
            ))}
          </div>

          <span
            aria-hidden="true"
            className="hidden h-5 w-px bg-stone-200 sm:block"
          />

          <div
            role="group"
            aria-label="Filter by severity"
            className="flex flex-wrap gap-1"
          >
            {ANOMALY_SEVERITY_FILTERS.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={severity === s.value}
                onClick={() => setSeverity(s.value)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400",
                  severity === s.value
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 rounded-full",
                    ANOMALY_SEVERITY_DOT_CLASSES[s.value],
                  )}
                />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {listQ.isError && (
          <p role="alert" className="text-xs text-red-500">
            {apiErrorMessage(listQ.error, "Failed to load anomalies.")}
          </p>
        )}

        {listQ.isLoading && <p className="text-xs text-stone-500">Loading…</p>}

        {!listQ.isLoading && !listQ.isError && items.length === 0 && (
          <p className="rounded-xl border border-dashed border-stone-200 px-4 py-10 text-center text-sm text-stone-500">
            {filter === "open"
              ? "Nothing needs your attention."
              : "No anomalies here."}
          </p>
        )}

        {items.length > 0 && (
          <ul
            className="flex flex-col gap-3 overflow-y-auto"
            aria-label="Anomalies"
          >
            {items.map((a) => (
              <AnomalyRow
                key={a.id}
                anomaly={a}
                busy={review.isPending}
                onReview={(id, status, note) =>
                  review.mutate({ id, status, note })
                }
              />
            ))}
          </ul>
        )}

        {(prevCursors.length > 0 || nextCursor) && (
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-stone-500 tabular-nums">
              Page {prevCursors.length + 1}
              {nextCursor ? "" : " · last page"}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={goPrev}
                disabled={prevCursors.length === 0}
                aria-label="Previous page"
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="size-3.5" />
                Previous
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!nextCursor}
                aria-label="Next page"
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
