import * as React from 'react';
import { ProposedEntityChips } from './ProposedEntityChips';
import { FieldProvenance } from './FieldProvenance';
import { ReviewFieldFrame } from './ReviewFieldFrame';
import { documentRoutes } from '@/lib/documentExtractionRoutes';
import type { DocumentReviewView, ReviewFieldConfig } from '@/hooks/documentReviewView';

interface ReviewFieldsPanelProps {
  review: DocumentReviewView;
  /** Which header rows to show and what they are called. */
  fields: ReviewFieldConfig;
}

interface PartyChoicesProps {
  review: DocumentReviewView;
  noun: string;
  searchSelector: string;
}

function PartyChoices({ review, noun, searchSelector }: PartyChoicesProps): React.JSX.Element | null {
  const party = review.party;
  if (!party || review.formPartyId) return null;
  const { candidates, extractedText } = party;
  return (
    <div className="space-y-1">
      {extractedText && <p className="text-stone-500 dark:text-stone-400">The document says {'“'}{extractedText}{'”'}.</p>}
      <div className="flex flex-wrap gap-1.5">
        {candidates.filter((c) => c.active).map((c) => (
          <button
            key={c.uuid}
            type="button"
            onClick={() => review.pickParty({ id: c.uuid, name: c.name })}
            aria-label={`Use ${noun} ${c.name}`}
            className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-stone-300 transition-colors hover:bg-stone-50 dark:hover:bg-white/10"
          >
            Use {c.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => document.querySelector<HTMLElement>(searchSelector)?.focus()}
          aria-label={`Search ${noun}s in the form below`}
          className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-stone-300 transition-colors hover:bg-stone-50 dark:hover:bg-white/10"
        >
          Search {noun}s
        </button>
      </div>
    </div>
  );
}

/** The header values read from the document, one row each: provenance marker,
 *  what the document said vs what the form holds, and a "Mark reviewed" toggle.
 *  An unmatched party (customer or vendor) offers the server's candidates inline. */
export function ReviewFieldsPanel({ review, fields }: ReviewFieldsPanelProps): React.JSX.Element | null {
  const handoff = review.handoff;
  if (!handoff) return null;
  const noun = documentRoutes(review.docType).partyLabel;
  const pendingKeys = new Set(review.pending.map((p) => p.key));
  const partyEntities = review.proposedEntities?.filter((e) => e.kind === 'customer' || e.kind === 'vendor');
  const rows = fields.order.filter((k) => handoff.provenance[k] || k === fields.partyKey);
  return (
    <section aria-label="Fields read from the document" className="grid gap-2 sm:grid-cols-2">
      {rows.map((key) => {
        const prov = handoff.provenance[key];
        const needs = pendingKeys.has(key);
        const reviewed = review.reviewed.has(key);
        const label = fields.labels[key];
        const current = review.fieldValue(key);
        return (
          <ReviewFieldFrame key={key} reviewKey={key} needsReview={needs} onFieldFocus={() => review.focusField(prov?.page, prov?.row)}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-stone-900 dark:text-stone-100">{label}</span>
              <FieldProvenance label={label} provenance={prov} needsReview={needs} onShowInDocument={review.showInDocument} />
            </div>
            {prov?.value && <p className="text-stone-600 dark:text-stone-300">Document: {prov.value}</p>}
            {current && current !== prov?.value && <p className="text-stone-800 dark:text-stone-200">Form: {current}</p>}
            {key === fields.partyKey && <PartyChoices review={review} noun={noun} searchSelector={fields.partySearchSelector} />}
            {key === fields.partyKey && (
              <ProposedEntityChips
                extractionId={review.extractionId}
                entities={review.formPartyId ? undefined : partyEntities}
                onCreated={(entity, ref) => review.pickParty({ id: ref.recordId, name: ref.label || entity.name })}
              />
            )}
            <button
              type="button"
              aria-pressed={reviewed}
              aria-label={`Reviewed, ${label}`}
              onClick={() => review.toggleReviewed(key)}
              className="rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 py-0.5 text-2xs font-medium text-stone-600 dark:text-stone-300 transition-colors hover:bg-stone-50 dark:hover:bg-white/10 aria-pressed:border-accent-foreground/30 aria-pressed:bg-accent aria-pressed:text-accent-foreground"
            >
              {reviewed ? 'Reviewed' : 'Mark reviewed'}
            </button>
          </ReviewFieldFrame>
        );
      })}
    </section>
  );
}
