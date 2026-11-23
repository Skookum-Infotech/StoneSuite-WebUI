import { accountLabel } from "@/lib/financeReportTables";
import type { PlAccount, PlSubcategory } from "@/types/reports";
import { PlAmountCell } from "./PlAmountCell";

interface PlSubcategoryRowsProps {
  sub: PlSubcategory;
  onAccountClick: (account: PlAccount) => void;
}

/** A sub-category's heading row followed by one clickable row per account. */
export function PlSubcategoryRows({ sub, onAccountClick }: PlSubcategoryRowsProps) {
  return (
    <>
      <tr>
        <th scope="row" className="px-3 py-1.5 pl-6 text-left font-medium text-stone-700">{sub.name}</th>
        <PlAmountCell value={sub.total} />
      </tr>
      {sub.accounts.map((account) => (
        <tr key={account.id} className="hover:bg-stone-50">
          <td className="px-3 py-1 pl-10">
            <button
              type="button"
              aria-label={`Show journal lines for ${accountLabel(account.code, account.name)}`}
              onClick={() => onAccountClick(account)}
              className="text-left text-stone-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
            >
              {accountLabel(account.code, account.name)}
            </button>
          </td>
          <PlAmountCell value={account.amount} />
        </tr>
      ))}
    </>
  );
}
