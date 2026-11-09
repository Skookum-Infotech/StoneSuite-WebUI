import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { customReportsService } from '@/services/customReportsService';
import type { CustomReportDefinition, CustomReportResult } from '@/types/customReports';

/** How long the definition must stay unchanged before the preview re-runs, so
 *  typing a filter value does not fire a request per keystroke. */
const RUN_DEBOUNCE_MS = 400;

/** Runs a run-ready definition (see runnableDefinition) for the live preview.
 *  The first run is immediate, later ones wait out the debounce, the previous
 *  result stays on screen while the next loads, and a superseded request is
 *  cancelled. A null definition (nothing to run yet) runs nothing. */
export function useCustomReportRun(definition: CustomReportDefinition | null): UseQueryResult<CustomReportResult> {
  const [settled, setSettled] = useState(definition);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(definition), RUN_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [definition]);

  return useQuery({
    queryKey: ['custom-report-run', settled],
    queryFn: ({ signal }) => customReportsService.run(settled as CustomReportDefinition, undefined, signal),
    enabled: settled !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
