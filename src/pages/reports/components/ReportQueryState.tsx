import { apiErrorMessage } from "@/api/tenantClient";

interface ReportQueryStateProps {
  isLoading: boolean;
  error: unknown;
}

const LOADING_TEXT = "Building report…";
const ERROR_FALLBACK = "Could not build the report.";

/** Loading / error line shown in place of a report's body; renders nothing
 *  once data is available. */
export function ReportQueryState({ isLoading, error }: ReportQueryStateProps) {
  if (error) {
    return (
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {apiErrorMessage(error, ERROR_FALLBACK)}
      </p>
    );
  }
  if (isLoading) {
    return (
      <p role="status" className="py-10 text-center text-sm text-stone-500">
        {LOADING_TEXT}
      </p>
    );
  }
  return null;
}
