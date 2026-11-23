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
            'rounded-full px-2 py-0.5 text-2xs font-semibold ring-1 ring-inset',
            ANOMALY_SEVERITY_CLASSES[anomaly.severity],
          )}
        >
          {ANOMALY_SEVERITY_LABELS[anomaly.severity]}
        </span>
        <span className="text-2xs font-medium text-stone-500">{anomalyRuleLabel(anomaly.ruleKey)}</span>
        <span className="text-2xs text-stone-400">
          · Detected {new Date(anomaly.detectedAt).toLocaleString()}
        </span>
        <span className="ml-auto rounded-md bg-stone-100 px-2 py-0.5 text-2xs font-medium text-stone-600">
          {ANOMALY_STATUS_LABELS[anomaly.status]}
        </span>
      </div>

      <h2 className="mt-2 text-sm font-semibold text-stone-900">{anomaly.title}</h2>
      {anomaly.detail && <p className="mt-1 text-xs text-stone-600">{anomaly.detail}</p>}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor={noteId} className="text-2xs font-medium text-stone-500">
            Note (optional)
          </label>
          <input
            id={noteId}
            type="text"
            value={note}
            maxLength={ANOMALY_NOTE_MAX_LENGTH}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 h-8 w-full rounded-lg border border-stone-200 bg-white px-2.5 text-xs text-stone-800 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
