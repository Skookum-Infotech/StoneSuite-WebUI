import { formatMoney } from '@/lib/formatMoney';
import type { ReportTable } from '@/lib/reportExport';
import { formatPercent, formatReportDate } from '@/lib/reportFormat';
import type { FinanceWindowParams, PlKind, ProfitLoss } from '@/types/reports';

const BLANK = '';

export const GROSS_PROFIT_LABEL = 'Gross profit';
export const NET_PROFIT_LABEL = 'Net profit';

/** What a section's total means in words, e.g. for an accessible label. */
export const PL_KIND_LABELS: Record<PlKind, string> = {
  income: 'Income',
  expense: 'Expense',
};

/** "4101 · Product Sales" — an account as a statement line. */
export function accountLabel(code: string, name: string): string {
  return code ? `${code} · ${name}` : name;
}

/** "Jan 1, 2026 to Nov 6, 2026". */
export function describeFinanceWindow(params: FinanceWindowParams): string {
  return `${formatReportDate(params.from)} to ${formatReportDate(params.to)}`;
}

/** True when the period has no P&L activity at all. */
export function isEmptyProfitLoss(pl: ProfitLoss): boolean {
  return pl.sections.length === 0;
}

/** Flattens the statement to Section / Sub-category / Account / Amount rows,
 *  section totals included, ending in Gross profit and Net profit — the same
 *  rows the on-screen statement shows. */
export function profitLossReportTable(pl: ProfitLoss, params: FinanceWindowParams): ReportTable {
  const rows: string[][] = [];
  for (const section of pl.sections) {
    for (const sub of section.subcategories) {
      for (const account of sub.accounts) {
        rows.push([section.name, sub.name, accountLabel(account.code, account.name), formatMoney(account.amount)]);
      }
    }
    rows.push([`Total ${section.name}`, BLANK, BLANK, formatMoney(section.total)]);
  }
  rows.push([GROSS_PROFIT_LABEL, BLANK, BLANK, formatMoney(pl.grossProfit)]);
  return {
    title: 'Profit and Loss',
    subtitle: `Journal entries dated ${describeFinanceWindow(params)} · income is credit less debit, expenses debit less credit · net margin ${formatPercent(pl.netMarginPercent)}`,
    headers: ['Section', 'Sub-category', 'Account', 'Amount'],
    rows,
    totalsRow: [NET_PROFIT_LABEL, BLANK, BLANK, formatMoney(pl.netProfit)],
  };
}
