// Mirrors RequisitionSummaryCard, reduced to the single row an expense claim
// carries — no subtotal/tax split (spec AD-3: total is a plain sum of line
// amounts, expense/calc.go's ComputeHeaderTotal).
export function ExpenseSummaryCard({ total }: { total: number }) {
  const fmt = (n: number) =>
    (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden sticky top-4">
      <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200">
        <p className="text-2xs font-semibold uppercase tracking-wide text-stone-500">Summary</p>
      </div>
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50">
        <span className="text-xs font-medium text-stone-700">Total</span>
        <span className="tabular-nums text-sm font-bold text-stone-900">{fmt(total)}</span>
      </div>
    </div>
  );
}
