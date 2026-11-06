import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReportFilters } from "@/hooks/useReportFilters";
import { formatMoney } from "@/lib/formatMoney";
import {
  GROSS_PROFIT_LABEL,
  NET_PROFIT_LABEL,
  accountLabel,
  isEmptyProfitLoss,
  profitLossReportTable,
} from "@/lib/financeReportTables";
import { formatPercent } from "@/lib/reportFormat";
import { reportsService } from "@/services/reportsService";
import type { FinanceWindowParams, PlAccount } from "@/types/reports";
import { ReportFilters } from "../components/ReportFilters";
import { ReportKpiGrid, type Kpi } from "../components/ReportKpiGrid";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";
import { ReportTopBarChart } from "../components/ReportTopBarChart";
import { AccountLinesPanel } from "./components/AccountLinesPanel";
import { ProfitLossStatement } from "./components/ProfitLossStatement";

const QUERY_KEY = "report-finance-profit-loss";
const EMPTY_TEXT = "No journal entries touch an income or expense account in this period.";
const NOTE =
  "Built from journal entries dated in the period, on P&L accounts only. Income categories are credit less debit and expense categories are debit less credit, so a sales return reduces revenue. Reversals are separate entries and net out. Gross profit is Revenue less Cost of Goods Sold. Select an account to see its journal lines.";

export default function ProfitLossPage() {
  const { state, actions } = useReportFilters();
  const [account, setAccount] = useState<PlAccount | null>(null);
  const params = useMemo<FinanceWindowParams>(() => ({ from: state.range.from, to: state.range.to }), [state.range.from, state.range.to]);

  const q = useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => reportsService.profitLoss(params),
    placeholderData: (prev) => prev,
  });

  const exportTable = useMemo(() => (q.data ? profitLossReportTable(q.data, params) : null), [q.data, params]);
  const chartData = useMemo(
    () => (q.data?.sections ?? []).map((s) => ({ label: s.name, revenue: s.total, margin: 0 })),
    [q.data],
  );
  const kpis = useMemo<Kpi[]>(() => {
    if (!q.data) return [];
    return [
      { label: "Income", value: formatMoney(q.data.income) },
      { label: "Expenses", value: formatMoney(q.data.expenses) },
      { label: GROSS_PROFIT_LABEL, value: formatMoney(q.data.grossProfit) },
      { label: NET_PROFIT_LABEL, value: formatMoney(q.data.netProfit) },
      { label: "Net margin", value: formatPercent(q.data.netMarginPercent) },
    ];
  }, [q.data]);

  return (
    <ReportPageShell
      title="Profit & Loss"
      description="Income, costs and what is left, from your journal entries."
      backTo="/reports/finance"
      exportTable={exportTable}
    >
      <ReportFilters state={state} actions={actions} />
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiGrid items={kpis} />
          {isEmptyProfitLoss(q.data) ? (
            <p className="rounded-xl border border-dashed border-stone-200 py-10 text-center text-sm text-stone-500">{EMPTY_TEXT}</p>
          ) : (
            <>
              <ReportTopBarChart data={chartData} label="Amount by category" names={{ primary: "Amount" }} />
              <ProfitLossStatement report={q.data} onAccountClick={setAccount} />
            </>
          )}
          <p className="text-label text-stone-500">{NOTE}</p>
        </>
      )}
      {account && (
        <AccountLinesPanel
          title={accountLabel(account.code, account.name)}
          accountId={account.id}
          params={params}
          onClose={() => setAccount(null)}
        />
      )}
    </ReportPageShell>
  );
}
