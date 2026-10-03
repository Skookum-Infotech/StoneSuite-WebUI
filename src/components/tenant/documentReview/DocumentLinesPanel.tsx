import * as React from 'react';
import { useState } from 'react';
import { InventoryItemPicker } from '@/pages/sales/components/InventoryItemPicker';
import { useItemUnitCode } from '@/hooks/useItemUnitCode';
import { LineStatusPill } from './LineStatusPill';
import { ReviewFieldFrame } from './ReviewFieldFrame';
import { calcLineItem, type SOLineItem } from '@/lib/salesOrderForm';
import { visiblePills } from '@/lib/documentReviewState';
import { lineReviewKey, type HandoffLine } from '@/lib/salesOrderDocumentHandoff';
import type { SalesOrderReviewMode } from '@/hooks/useSalesOrderReviewMode';
import type { InventoryItem } from '@/types/inventory';

interface DocumentLinesPanelProps {
  review: SalesOrderReviewMode;
}

interface LineReviewRowProps {
  meta: HandoffLine;
  line: SOLineItem;
  needsReview: boolean;
  reviewed: boolean;
  review: SalesOrderReviewMode;
}

function LineReviewRow({ meta, line, needsReview, reviewed, review }: LineReviewRowProps): React.JSX.Element {
  const unitCodeFor = useItemUnitCode();
  const [text, setText] = useState(line.itemName);
  const [pickedPrice, setPickedPrice] = useState<number | null>(null);
  const hasItem = Boolean(line.inventoryItemUuid);
  const key = lineReviewKey(meta.lineNo);
  const prov = review.handoff?.provenance[key];
  const label = `Line ${meta.lineNo}`;

  const onPick = (item: InventoryItem): void => {
    // The document's quantity and price are kept; only the item identity changes.
    const next = { ...line, itemName: item.name, itemSku: item.sku, units: unitCodeFor(item), inventoryItemUuid: item.id };
    review.updateLine(line.id, { ...next, ...calcLineItem(next) });
    setPickedPrice(item.unitPrice);
    setText(item.name);
  };

  return (
    <ReviewFieldFrame reviewKey={key} needsReview={needsReview} onFieldFocus={() => review.focusField(prov?.page, prov?.row)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-stone-900 dark:text-stone-100">{label}</span>
        {visiblePills(meta, hasItem, pickedPrice, parseFloat(line.unitPrice) || 0).map((p) => (
          <LineStatusPill key={p.label} kind={p.kind} label={p.label} />
        ))}
      </div>
      {meta.requiresItem && !hasItem ? (
        <InventoryItemPicker value={text} onTextChange={setText} onPick={onPick} />
      ) : (
        <p className="text-stone-800 dark:text-stone-200">{line.itemName} {'·'} {line.quantity} {line.units} {'×'} ${line.unitPrice}</p>
      )}
      <p className="text-stone-500 dark:text-stone-400">Document: {meta.docText || '(no text)'}</p>
      {meta.conversionNote && <p className="text-stone-500 dark:text-stone-400">{meta.conversionNote}</p>}
      {!meta.requiresItem && (
        <button
          type="button"
          aria-pressed={reviewed}
          aria-label={`${reviewed ? 'Reviewed' : 'Mark reviewed'}, ${label}`}
          onClick={() => review.toggleReviewed(key)}
          className="rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 py-0.5 text-2xs font-medium text-stone-600 dark:text-stone-300 transition-colors hover:bg-stone-50 dark:hover:bg-white/10 aria-pressed:border-accent-foreground/30 aria-pressed:bg-accent aria-pressed:text-accent-foreground"
        >
          {reviewed ? 'Reviewed' : 'Mark reviewed'}
        </button>
      )}
    </ReviewFieldFrame>
  );
}

/** One row per line read from the document, with its status pills. A line with
 *  no matched item opens the existing item picker pre-searched with the
 *  document's text (kept in grey beneath it). */
export function DocumentLinesPanel({ review }: DocumentLinesPanelProps): React.JSX.Element | null {
  const handoff = review.handoff;
  if (!handoff || handoff.lines.length === 0) return null;
  const pendingKeys = new Set(review.pending.map((p) => p.key));
  const rows = handoff.lines.flatMap((meta) => {
    const line = review.form.lineItems.find((l) => l.id === meta.id);
    return line ? [{ meta, line }] : [];
  });
  return (
    <section aria-label="Lines read from the document" className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Document lines</h3>
      {rows.map(({ meta, line }) => {
        const key = lineReviewKey(meta.lineNo);
        return (
          <LineReviewRow
            key={meta.id}
            meta={meta}
            line={line}
            needsReview={pendingKeys.has(key)}
            reviewed={review.reviewed.has(key)}
            review={review}
          />
        );
      })}
    </section>
  );
}
