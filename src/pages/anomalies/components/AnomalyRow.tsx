import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ANOMALY_NOTE_MAX_LENGTH,
  ANOMALY_SEVERITY_CLASSES,
  ANOMALY_SEVERITY_LABELS,
  ANOMALY_STATUS_LABELS,
  anomalyRuleLabel,
  reviewActions,
} from '@/lib/anomaly';
import { cn } from '@/lib/utils';
import type { Anomaly, AnomalyStatus } from '@/types/anomaly';

interface Props {
  anomaly: Anomaly;
  busy: boolean;
  onReview: (id: string, status: AnomalyStatus, note: string) => void;
}

export function AnomalyRow({ anomaly, busy, onReview }: Props) {
  const [note, setNote] = useState(anomaly.note);
  const noteId = `anomaly-note-${anomaly.id}`;

  return (
    <li className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 ring-1 ring-inset type-pill',
            ANOMALY_SEVERITY_CLASSES[anomaly.severity],
          )}
        >
          {ANOMALY_SEVERITY_LABELS[anomaly.severity]}
        </span>
        <span className="text-micro font-medium text-ink-muted">{anomalyRuleLabel(anomaly.ruleKey)}</span>
        <span className="type-subline">
          · Detected {new Date(anomaly.detectedAt).toLocaleString()}
        </span>
        <span className="ml-auto rounded-md bg-stone-100 px-2 py-0.5 text-ink type-pill">
          {ANOMALY_STATUS_LABELS[anomaly.status]}
        </span>
      </div>

      <h2 className="mt-2 type-card-title">{anomaly.title}</h2>
      {anomaly.detail && <p className="mt-1 text-xs text-ink">{anomaly.detail}</p>}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor={noteId} className="type-field-label">
            Note (optional)
          </label>
          <input
            id={noteId}
            type="text"
            value={note}
            maxLength={ANOMALY_NOTE_MAX_LENGTH}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 h-8 w-full rounded-lg border border-stone-200 bg-white px-2.5 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 type-input"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {reviewActions(anomaly.status).map((action) => (
            <Button
              key={action.to}
              type="button"
              size="sm"
              variant={action.to === 'dismissed' ? 'outline' : action.to === 'open' ? 'ghost' : 'default'}
              disabled={busy}
              aria-label={`${action.label}: ${anomaly.title}`}
              onClick={() => onReview(anomaly.id, action.to, note)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </li>
  );
}
