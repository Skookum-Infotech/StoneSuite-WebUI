import { cn } from '@/lib/utils';

/** How much a figure stands out in the strip — through weight and colour, never
 *  size.
 *  - quiet: a component of a total (Subtotal, Discount, Tax).
 *  - strong: a headline figure (Grand Total, Amount) — bolder and darker.
 *  - key: the one figure to read first (Balance Due, Unapplied) — bold on a
 *    lime tint, and meant for at most one item per strip. */
export type AmountEmphasis = 'quiet' | 'strong' | 'key';

export interface AmountItem {
  label: string;
  value: number;
  emphasis?: AmountEmphasis;
}

const DEFAULT_CURRENCY_CODE = 'USD';

// Tiles wrap to whatever width the page column has (it is narrow beside the
// 18rem sidebar) and grow to fill each row, so any number of figures lays out
// without empty cells. The 1px dividers are each tile's top/left border, with
// the list pulled 1px up and left so the outer edges fall under the card's own
// border — which is why the list is also 1px wider than the card.
const STRIP_SHELL = 'overflow-hidden rounded-[10px] border border-stone-200 bg-white';
const STRIP_LIST = '-ml-px -mt-px flex w-[calc(100%+1px)] flex-wrap';
const TILE = 'flex flex-[1_1_9rem] flex-col justify-between gap-1.5 border-l border-t border-stone-200 px-4 py-3';

// Every label is one size and every figure is one size, so the strip reads as a
// single row of the same kind of thing. Emphasis is carried by weight, colour
// and the tint alone — never by making a figure bigger.
const LABEL_TEXT = 'text-xs';
const VALUE_TEXT = 'text-sm';

const KEY_TILE = 'bg-accent';

const LABEL_BY_EMPHASIS: Record<AmountEmphasis, string> = {
  quiet: 'text-stone-500',
  strong: 'text-stone-500',
  key: 'font-medium text-accent-foreground',
};

const VALUE_BY_EMPHASIS: Record<AmountEmphasis, string> = {
  quiet: 'font-medium text-stone-600',
  strong: 'font-bold text-stone-950',
  key: 'font-bold text-accent-foreground',
};

// A component that is nothing (no discount, no adjustment) recedes so the
// figures that do carry a value read first. Headline figures never recede —
// a $0.00 balance is information, not filler.
const ZERO_QUIET_VALUE = 'text-stone-400';

export function AmountsStrip({ items, currencyCode = DEFAULT_CURRENCY_CODE }: {
  items: AmountItem[];
  currencyCode?: string;
}) {
  const money = (value: number) => value.toLocaleString(undefined, { style: 'currency', currency: currencyCode });

  return (
    <div role="group" aria-label="Amounts" className={STRIP_SHELL}>
      <dl className={STRIP_LIST}>
        {items.map(({ label, value, emphasis = 'quiet' }) => (
          <div key={label} className={cn(TILE, emphasis === 'key' && KEY_TILE)}>
            <dt className={cn(LABEL_TEXT, LABEL_BY_EMPHASIS[emphasis])}>{label}</dt>
            <dd
              className={cn(
                'whitespace-nowrap tabular-nums',
                VALUE_TEXT,
                VALUE_BY_EMPHASIS[emphasis],
                emphasis === 'quiet' && value === 0 && ZERO_QUIET_VALUE,
              )}
            >
              {money(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
