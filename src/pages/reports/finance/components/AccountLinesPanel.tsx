import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { apiErrorMessage } from "@/api/tenantClient";
import { useModalDialog } from "@/hooks/useModalDialog";
import { formatMoney } from "@/lib/formatMoney";
import { formatReportDate } from "@/lib/reportFormat";
import { reportsService } from "@/services/reportsService";
import type { FinanceWindowParams } from "@/types/reports";

interface AccountLinesPanelProps {
  /** The account's display name, e.g. "4101 · Product Sales". */
  title: string;
  accountId: string;
  params: FinanceWindowParams;
  onClose: () => void;
}

const QUERY_KEY = "report-finance-account-lines";
const LOADING_TEXT = "Loading journal lines…";
const EMPTY_TEXT = "No journal lines in this period.";
const JOURNAL_PATH = "/finance/journal-entries";
const NO_AMOUNT = "";

// Right-hand panel listing the journal lines behind one P&L account, each
// linking to its journal entry. Mounted fresh per opened account
// (useModalDialog's focus effect fires once per mount), like the app's other
// dialogs.
export function AccountLinesPanel({ title, accountId, params, onClose }: AccountLinesPanelProps) {
  const contentRef = useModalDialog(onClose);
  const q = useQuery({
    queryKey: [QUERY_KEY, accountId, params],
    queryFn: () => reportsService.accountLines(accountId, params),
  });

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/30" onClick={onClose}>
      <aside
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Journal lines for ${title}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl outline-none"
      >
        <header className="flex items-start justify-between gap-3 border-b border-stone-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-stone-900">{title}</h2>
            <p className="text-label text-stone-500">Journal lines behind this figure</p>
          </div>
          <button
            type="button"
            aria-label="Close journal lines panel"
            onClick={onClose}
            className="rounded-md p-1 text-stone-500 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {q.isLoading && <p className="text-sm text-stone-500">{LOADING_TEXT}</p>}
          {q.isError && (
            <p role="alert" className="text-sm text-red-600">
              {apiErrorMessage(q.error, "Could not load the journal lines.")}
            </p>
          )}
          {q.data && q.data.length === 0 && <p className="text-sm text-stone-500">{EMPTY_TEXT}</p>}
          {q.data && q.data.length > 0 && (
            <ul className="divide-y divide-stone-100">
              {q.data.map((l, i) => (
                <li key={`${l.entryId}:${i}`} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link
                      to={`${JOURNAL_PATH}/${l.entryId}`}
                      aria-label={`Open journal entry ${l.number || "(no number)"}`}
                      className="text-sm font-medium text-stone-900 underline-offset-2 hover:underline"
                    >
                      {l.number || "(no number)"}
                    </Link>
                    <p className="truncate text-label text-stone-500">
                      {formatReportDate(l.date)} · {l.sourceType}
                      {l.memo ? ` · ${l.memo}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm tabular-nums text-stone-700">
                    {l.debit > 0 ? <span>{formatMoney(l.debit)} Dr</span> : null}
                    {l.credit > 0 ? <span>{formatMoney(l.credit)} Cr</span> : null}
                    {l.debit <= 0 && l.credit <= 0 ? NO_AMOUNT : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
