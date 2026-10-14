import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Copy, MessageSquarePlus, Trash2 } from 'lucide-react';
import { textareaCls } from '@/components/crm/formUtils';
import { areaKindConfig } from '@/lib/createdOrderAreas';
import { areaProgress, NOTES_MAX_LENGTH } from '@/lib/createdOrderForm';
import type { AreaDraft, AreaErrorField, AreaFieldChange } from '@/lib/createdOrderForm';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { AreaFields } from './AreaFields';
import { Field } from './Field';
import { FaucetSpreadSelector } from './FaucetSpreadSelector';

/** What a card can do to its area. One object rather than three props, and
 *  every callback takes the area's key so the page can pass one stable set to
 *  every card. */
export interface AreaCardActions {
  onFieldChange: <K extends keyof AreaDraft>(areaKey: string, field: K, value: AreaDraft[K]) => void;
  onRemove: (areaKey: string) => void;
  onCopyStone: (areaKey: string) => void;
}

interface AreaCardProps {
  area: AreaDraft;
  errors: Partial<Record<AreaErrorField, string>> | undefined;
  /** Name of the area whose Color / Finish / Edge this one can copy, or
   *  undefined when there is nothing to copy from. */
  copyFromName: string | undefined;
  actions: AreaCardActions;
  /** The area the customer just added — scrolled into view when it mounts, so
   *  a card added below the fold is not mistaken for "nothing happened". */
  isNew: boolean;
}

const NOTES_ROWS = 2;

// One area of the order. A card the customer is done with collapses to a single
// line with a "3 of 5 filled" hint; a card with a problem cannot be collapsed,
// so an error never hides behind a closed header.
export function AreaCard({ area, errors, copyFromName, actions, isNew }: AreaCardProps) {
  const articleRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const hasErrors = errors !== undefined && Object.keys(errors).length > 0;
  const isOpen = open || hasErrors;
  const { filled, total } = areaProgress(area);
  const { spreadScale } = areaKindConfig(area.kind);
  const bodyId = `area-body-${area.key}`;
  const showNotes = notesOpen || area.notes !== '';

  const change: AreaFieldChange = (field, value) => actions.onFieldChange(area.key, field, value);

  // Mount-only on purpose: `isNew` is true for exactly the card that was just
  // added, and later renders must not re-scroll the page back to it.
  useEffect(() => {
    if (isNew) articleRef.current?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <article
      ref={articleRef}
      aria-label={area.name || 'Unnamed area'}
      className={cn(
        'rounded-xl border bg-white transition-shadow',
        hasErrors ? 'border-red-300 ring-1 ring-red-100' : 'border-stone-200',
      )}
    >
      <header className="flex items-center gap-2 px-3 py-2 sm:px-4">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${area.name || 'area'}`}
          onClick={() => setOpen((prev) => !prev)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <ChevronDown
            className={cn('size-4 shrink-0 text-stone-400 transition-transform', !isOpen && '-rotate-90')}
            aria-hidden="true"
          />
          <span className="truncate text-sm font-semibold text-stone-900">{area.name || 'Unnamed area'}</span>
          {hasErrors ? (
            <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
              Needs attention
            </span>
          ) : (
            <span className="shrink-0 text-xs text-stone-400">
              {filled} of {total} filled
            </span>
          )}
        </button>
        <button
          type="button"
          aria-label={`Remove ${area.name || 'area'}`}
          onClick={() => actions.onRemove(area.key)}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-stone-400 outline-none transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-300"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </header>

      {isOpen && (
        <div id={bodyId} className="space-y-5 border-t border-stone-100 px-3 py-4 sm:px-4">
          {copyFromName !== undefined && (
            <button
              type="button"
              aria-label={`Copy Color, Finish and Edge from ${copyFromName}`}
              onClick={() => actions.onCopyStone(area.key)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-stone-50 px-2.5 py-1.5 text-xs font-medium text-stone-600 outline-none ring-1 ring-stone-200 transition-colors hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <Copy className="size-3.5" aria-hidden="true" />
              Same stone as {copyFromName}
            </button>
          )}

          <AreaFields area={area} errors={errors ?? {}} onChange={change} />

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-stone-900">Faucet Spread</p>
            <FaucetSpreadSelector
              areaName={area.name}
              scale={spreadScale}
              value={area.faucetSpread}
              onChange={(next) => change('faucetSpread', next)}
            />
          </div>

          {showNotes ? (
            <Field label="Notes">
              {(control) => (
                <textarea
                  {...control}
                  rows={NOTES_ROWS}
                  value={area.notes}
                  maxLength={NOTES_MAX_LENGTH}
                  placeholder={`Anything specific to the ${area.name || 'area'}`}
                  onChange={(e) => change('notes', e.target.value)}
                  className={textareaCls}
                />
              )}
            </Field>
          ) : (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-stone-500 outline-none transition-colors hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <MessageSquarePlus className="size-3.5" aria-hidden="true" />
              Add notes
            </button>
          )}
        </div>
      )}
    </article>
  );
}
