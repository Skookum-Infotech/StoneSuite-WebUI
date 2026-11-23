import { useMemo, useState } from 'react';
import {
  DEFAULT_REPORT_PRESET,
  resolveReportRange,
  type ReportDateRange,
  type ReportRangePreset,
} from '@/lib/reportDateRange';
import type { SalesBasis, SalesReportParams, TrendBucket } from '@/types/reports';

export interface ReportFilterState {
  preset: ReportRangePreset;
  range: ReportDateRange;
  basis: SalesBasis;
  bucket: TrendBucket;
}

export interface ReportFilterActions {
  setPreset: (preset: ReportRangePreset) => void;
  setCustomRange: (range: ReportDateRange) => void;
  setBasis: (basis: SalesBasis) => void;
  setBucket: (bucket: TrendBucket) => void;
}

const DEFAULT_BASIS: SalesBasis = 'invoices';
const DEFAULT_BUCKET: TrendBucket = 'month';

/** Local state for a report page's filter bar, plus the request params it
 *  implies. Filters are page-local on purpose: each report is a separate
 *  question and keeps its own window. */
export function useReportFilters(): {
  state: ReportFilterState;
  actions: ReportFilterActions;
  params: SalesReportParams;
} {
  const [preset, setPresetState] = useState<ReportRangePreset>(DEFAULT_REPORT_PRESET);
  const [range, setRange] = useState<ReportDateRange>(() => resolveReportRange(DEFAULT_REPORT_PRESET, new Date()));
  const [basis, setBasis] = useState<SalesBasis>(DEFAULT_BASIS);
  const [bucket, setBucket] = useState<TrendBucket>(DEFAULT_BUCKET);

  const actions: ReportFilterActions = {
    setPreset: (next) => {
      setPresetState(next);
      // Picking "Custom" keeps the current window so the pickers start from it.
      if (next !== 'custom') setRange(resolveReportRange(next, new Date()));
    },
    setCustomRange: (next) => {
      setPresetState('custom');
      setRange(next);
    },
    setBasis,
    setBucket,
  };

  // The bucket is deliberately not part of the shared params: only the trend
  // report sends it, and the others must not refetch when it changes.
  const params = useMemo<SalesReportParams>(
    () => ({ basis, from: range.from, to: range.to }),
    [basis, range.from, range.to],
  );

  return { state: { preset, range, basis, bucket }, actions, params };
}
