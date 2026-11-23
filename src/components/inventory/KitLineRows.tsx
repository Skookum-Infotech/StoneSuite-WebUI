import { Fragment, type ReactNode } from 'react';
import { KitHeadingRow, KIT_ROW_CLS } from '@/components/inventory/KitHeadingRow';
import { kitHeadings, type KitLabeled } from '@/lib/kitLines';

/** The body rows of a read-only items table, with a kit heading above each run
 *  of lines that came from a kit. `renderRow` draws one line and receives the
 *  class that marks it as inside a kit (undefined for an ordinary line), so the
 *  page keeps its own column layout. */
export function KitLineRows<L extends KitLabeled & { id: string }>({ lines, colSpan, renderRow }: {
  lines: readonly L[];
  /** Columns in the table — the heading spans them all. */
  colSpan: number;
  renderRow: (line: L, kitCls: string | undefined) => ReactNode;
}) {
  const headings = kitHeadings(lines);
  return (
    <>
      {lines.map((line) => {
        const heading = headings.get(line.id);
        return (
          <Fragment key={line.id}>
            {heading && <KitHeadingRow name={heading.kitName} count={heading.count} colSpan={colSpan} />}
            {renderRow(line, line.kitId ? KIT_ROW_CLS : undefined)}
          </Fragment>
        );
      })}
    </>
  );
}
