import { formatMoney } from "@/lib/formatMoney";
import { GROSS_PROFIT_LABEL, NET_PROFIT_LABEL } from "@/lib/financeReportTables";
import { cn } from "@/lib/utils";
import type { PlAccount, ProfitLoss } from "@/types/reports";
import { PlAmountCell } from "./PlAmountCell";
import { PlSectionRows } from "./PlSectionRows";

interface ProfitLossStatementProps {
  report: ProfitLoss;
  /** Opens the journal lines behind an account. */
  onAccountClick: (account: PlAccount) => void;
}

const REVENUE_CATEGORY_CODE = 4000;
const COGS_CATEGORY_CODE = 5000;

/** The Gross profit line goes after Cost of Goods Sold, or after Revenue when
 *  the period has no cost of goods; null when there is neither. */
function grossProfitAfter(report: ProfitLoss): number | null {
  if (report.sections.some((s) => s.code === COGS_CATEGORY_CODE)) return COGS_CATEGORY_CODE;
  if (report.sections.some((s) => s.code === REVENUE_CATEGORY_CODE)) return REVENUE_CATEGORY_CODE;
  return null;
}

/** The statement itself: each category with its sub-categories and accounts, a
 *  Gross profit line, and Net profit at the foot. Accounts open their journal
 *  lines. */
export function ProfitLossStatement({ report, onAccountClick }: ProfitLossStatementProps) {
  const grossAfter = grossProfitAfter(report);
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <caption className="sr-only">Profit and loss statement</caption>
        <thead className="bg-stone-50 text-label text-stone-500">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">Account</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {report.sections.map((section) => (
            <PlSectionRows key={section.code} section={section} onAccountClick={onAccountClick}>
              {section.code === grossAfter && (
                <tr className="border-t border-stone-200 bg-stone-50">
                  <th scope="row" className="px-3 py-2 text-left font-semibold text-stone-900">{GROSS_PROFIT_LABEL}</th>
                  <PlAmountCell value={report.grossProfit} strong />
                </tr>
              )}
            </PlSectionRows>
          ))}
          <tr className="border-t-2 border-stone-300 bg-stone-100">
            <th scope="row" className="px-3 py-2.5 text-left text-base font-bold text-stone-900">{NET_PROFIT_LABEL}</th>
            <td className={cn("px-3 py-2.5 text-right text-base font-bold tabular-nums", report.netProfit < 0 ? "text-red-700" : "text-stone-900")}>
              {formatMoney(report.netProfit)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
