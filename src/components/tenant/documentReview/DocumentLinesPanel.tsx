import * as React from 'react';
import { useState } from 'react';
import { InventoryItemPicker } from '@/pages/sales/components/InventoryItemPicker';
import { useItemUnitCode } from '@/hooks/useItemUnitCode';
import { ProposedEntityChips } from './ProposedEntityChips';
import { LineStatusPill } from './LineStatusPill';
import { ReviewFieldFrame } from './ReviewFieldFrame';
import { PoLineSelect } from './PoLineSelect';
import { visiblePills } from '@/lib/documentReviewState';
import { lineReviewKey, type HandoffLine } from '@/lib/documentHandoffShared';
import { convertLine, sameUnit } from '@/lib/unitConversion';
import type { DocumentReviewView, ReviewLineLike } from '@/hooks/documentReviewView';
import { inventoryService } from '@/services/inventoryService';
import type { InventoryItem } from '@/types/inventory';
import type { ProposedEntityView } from '@/types/documentExtraction';
import type { ProposedActionResultRef } from '@/types/proposedAction';

interface DocumentLinesPanelProps {
  review: DocumentReviewView;
}

interface LineReviewRowProps {
  meta: HandoffLine;
  line: ReviewLineLike;
  needsReview: boolean;
  reviewed: boolean;
  review: DocumentReviewView;
}

function itemEntities(review: DocumentReviewView): ProposedEntityView[] {
  return (review.proposedEntities ?? []).filter((e) => e.kind === 'item');
}

/** `source.lines` are 0-based indexes into the extraction's lines (docIndex),
 *  not display line numbers. The chip sits on the first covered docIndex that
 *  has a form line; creating the item selects it on the other covered lines. */
function anchorDocIndex(entity: ProposedEntityView, docIndexes: ReadonlySet<number>): number | undefined {
  return entity.source.lines?.find((i) => docIndexes.has(i));
}

function itemEntitiesFor(review: DocumentReviewView, docIndex: number): ProposedEntityView[] {
  const docIndexes = new Set((review.handoff?.lines ?? []).map((l) => l.docIndex));
  return itemEntities(review).filter((e) => anchorDocIndex(e, docIndexes) === docIndex);
}

/** Proposals that cover no form line: shown above the lines, selecting nothing on create. */
function unplacedItemEntities(review: DocumentReviewView, docIndexes: readonly number[]): ProposedEntityView[] {
  const set = new Set(docIndexes);
  return itemEntities(review).filter((e) => anchorDocIndex(e, set) === undefined);
}

function LineReviewRow({ meta, line, needsReview, reviewed, review }: LineReviewRowProps): React.JSX.Element {
  const unitCodeFor = useItemUnitCode();
  const [text, setText] = useState(line.itemName);
  const poChoices = review.poLineChoices?.(line.id) ?? [];
  const [pickedPrice, setPickedPrice] = useState<number | null>(null);
  const [pickNote, setPickNote] = useState('');
  const hasItem = Boolean(line.inventoryItemUuid);
  const key = lineReviewKey(meta.lineNo);
  const prov = review.handoff?.provenance[key];
  const label = `Line ${meta.lineNo}`;

  const onPick = (item: InventoryItem): void => {
    // The item identity changes; the document's quantity, price and description
    // are kept. When the item is sold in another unit of the same kind (SQM vs
    // SQFT) the quantity and price convert so the line amount stays the same;
    // otherwise the review keeps a required "check the quantity" item open.
    const toUnit = unitCodeFor(item);
    const fromUnit = meta.docUom || line.units;
    const qty = parseFloat(line.quantity) || 0;
    const price = parseFloat(line.unitPrice) || 0;
    const conv = fromUnit && toUnit && !sameUnit(fromUnit, toUnit) ? convertLine(qty, price, fromUnit, toUnit) : null;
    const next = {
      ...line, itemName: item.name, itemSku: item.sku, units: toUnit, inventoryItemUuid: item.id,
      ...(conv ? { quantity: String(conv.quantity), unitPrice: conv.unitPrice.toFixed(2) } : {}),
    };
    review.updateLine(line.id, { ...next, ...review.calcLine(next) });
    setPickedPrice(item.unitPrice);
    setPickNote(conv ? `Converted ${qty} ${fromUnit} to ${conv.quantity} ${toUnit}` : '');
    setText(item.name);
  };

  // A freshly created item: load it so the line gets its real unit/price, then
  // select it exactly like a pick from the picker. Other lines the proposal
  // covers that still have no item get the identity only.
  const onItemCreated = async (entity: ProposedEntityView, ref: ProposedActionResultRef): Promise<void> => {
    // A failed load falls back to the identity from the confirm result.
    const item = await inventoryService.getItem(ref.recordId).catch(() => null);
    if (item) onPick(item);
    else review.updateLine(line.id, { itemName: ref.label || entity.name, inventoryItemUuid: ref.recordId });
    for (const idx of entity.source.lines ?? []) {
      if (idx === meta.docIndex) continue;
      const other = review.handoff?.lines.find((l) => l.docIndex === idx);
      const target = other && review.lineItems.find((l) => l.id === other.id);
      if (!target || target.inventoryItemUuid) continue;
      const next = {
        ...target,
        itemName: item?.name ?? (ref.label || entity.name),
        itemSku: item?.sku ?? target.itemSku,
        units: item ? unitCodeFor(item) || target.units : target.units,
        inventoryItemUuid: ref.recordId,
      };
      review.updateLine(target.id, { ...next, ...review.calcLine(next) });
    }
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
      <ProposedEntityChips
        extractionId={review.extractionId}
        entities={hasItem ? undefined : itemEntitiesFor(review, meta.docIndex)}
        onCreated={(entity, ref) => { void onItemCreated(entity, ref); }}
      />
      <p className="text-stone-500 dark:text-stone-400">Document: {meta.docText || '(no text)'}</p>
      {(pickNote || meta.conversionNote) && <p className="text-stone-500 dark:text-stone-400">{pickNote || meta.conversionNote}</p>}
      {poChoices.length > 1 && review.setPoLine && (
        <PoLineSelect
          label={label}
          choices={poChoices}
          value={review.poLineOf?.(line.id) ?? ''}
          onChange={(poItemId) => review.setPoLine?.(line.id, poItemId)}
        />
      )}
      {(!meta.requiresItem || hasItem) && (
        <button
          type="button"
          aria-pressed={reviewed}
          aria-label={`Reviewed, ${label}`}
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
    const line = review.lineItems.find((l) => l.id === meta.id);
    return line ? [{ meta, line }] : [];
  });
  return (
    <section aria-label="Lines read from the document" className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Document lines</h3>
      <ProposedEntityChips
        extractionId={review.extractionId}
        entities={unplacedItemEntities(review, handoff.lines.map((l) => l.docIndex))}
        onCreated={() => undefined}
      />
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
