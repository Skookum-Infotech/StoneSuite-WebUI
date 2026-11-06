import type { ReactNode } from "react";
import type { PlAccount, PlSection } from "@/types/reports";
import { PlAmountCell } from "./PlAmountCell";
import { PlSubcategoryRows } from "./PlSubcategoryRows";

interface PlSectionRowsProps {
  section: PlSection;
  onAccountClick: (account: PlAccount) => void;
  /** Extra rows shown right after the section's total (e.g. Gross profit). */
  children?: ReactNode;
}

/** One category: its heading, sub-categories and accounts, then its total. */
export function PlSectionRows({ section, onAccountClick, children }: PlSectionRowsProps) {
  return (
    <>
      <tr className="border-t border-stone-200">
        <th scope="rowgroup" colSpan={2} className="bg-stone-50/60 px-3 py-2 text-left text-label font-semibold uppercase tracking-wide text-stone-600">
          {section.name}
        </th>
      </tr>
      {section.subcategories.map((sub) => (
        <PlSubcategoryRows key={sub.name} sub={sub} onAccountClick={onAccountClick} />
      ))}
      <tr>
        <th scope="row" className="px-3 py-2 text-left font-semibold text-stone-900">Total {section.name}</th>
        <PlAmountCell value={section.total} strong />
      </tr>
      {children}
    </>
  );
}
