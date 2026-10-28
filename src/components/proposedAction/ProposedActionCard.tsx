import { useState } from 'react';
import { AxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { apiErrorMessage } from '@/api/tenantClient';
import { useCancelProposedAction, useConfirmProposedAction } from '@/hooks/useProposedActions';
import type { ProposedAction, ProposedActionConfirmResult } from '@/types/proposedAction';
import { PROPOSED_ACTION_STRINGS as S } from './proposedActionStrings';

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_GONE = 410;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

interface ProposedActionCardProps {
  action: ProposedAction;
  onConfirmed?: (action: ProposedAction) => void;
  /** Called with the full confirm result (action incl. resultRef, and `replayed`). */
  onConfirmResult?: (result: ProposedActionConfirmResult) => void;
  onCancelled?: (action: ProposedAction) => void;
  /** Called with the raw failure of a confirm/cancel call (any status). */
  onError?: (err: unknown) => void;
  /** When set, Confirm is disabled and this text is exposed as its description. */
  disabledReason?: string;
  /** When set, the created record's label renders as a link to this route. */
  resultHref?: string;
}

function errorStatus(err: unknown): number | undefined {
  return err instanceof AxiosError ? err.response?.status : undefined;
}

// 422 carries a server message worth showing verbatim; others get fixed copy.
// 404 never reaches here: it is handled as the non-actionable "unavailable" state.
function errorText(err: unknown): string {
  switch (errorStatus(err)) {
    case HTTP_FORBIDDEN:
      return S.noPermission;
    case HTTP_CONFLICT:
      return S.conflict;
    default:
      return apiErrorMessage(err, S.genericError);
  }
}

function formatExpiry(expiresAt: string, now: number): { relative: string; absolute: string } {
  const at = new Date(expiresAt);
  const absolute = at.toLocaleString();
  const minutes = Math.round((at.getTime() - now) / MS_PER_MINUTE);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const abs = Math.abs(minutes);
  let relative: string;
  if (abs < MINUTES_PER_HOUR) relative = rtf.format(minutes, 'minute');
  else if (abs < MINUTES_PER_HOUR * HOURS_PER_DAY) relative = rtf.format(Math.round(minutes / MINUTES_PER_HOUR), 'hour');
  else relative = rtf.format(Math.round(minutes / (MINUTES_PER_HOUR * HOURS_PER_DAY)), 'day');
  return { relative, absolute };
}

const STATUS_LABEL = {
  confirmed: S.statusConfirmed,
  cancelled: S.statusCancelled,
  expired: S.statusExpired,
  failed: S.statusFailed,
} as const;

/** Preview of a proposed change with Confirm/Cancel; drives its own mutations. */
export function ProposedActionCard({
  action, onConfirmed, onConfirmResult, onCancelled, onError, disabledReason, resultHref,
}: ProposedActionCardProps) {
  const confirmM = useConfirmProposedAction();
  const cancelM = useCancelProposedAction();
  // Latest server-returned copy (or locally-detected expiry) wins over the prop
  // until the parent refetches with the same id.
  const [override, setOverride] = useState<ProposedAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Id of an action the server answered 404 for (unknown, someone else's, or the
  // target record is out of the caller's scope: indistinguishable by design).
  const [unavailableId, setUnavailableId] = useState<string | null>(null);
  const [replayed, setReplayed] = useState(false);
  const [now] = useState(() => Date.now());

  const current = override && override.id === action.id ? override : action;
  const unavailable = unavailableId === current.id;
  const busy = confirmM.isPending || cancelM.isPending;
  const titleId = `proposed-action-${current.id}-title`;
  const reasonId = `proposed-action-${current.id}-reason`;
  const { relative, absolute } = formatExpiry(current.expiresAt, now);

  const handleConfirm = () => {
    setError(null);
    confirmM.mutate(current.id, {
      onSuccess: (res) => {
        setOverride(res.action);
        setReplayed(res.replayed);
        onConfirmed?.(res.action);
        onConfirmResult?.(res);
      },
      onError: (err) => {
        onError?.(err);
        if (errorStatus(err) === HTTP_GONE) {
          setOverride({ ...current, status: 'expired' });
          return;
        }
        if (errorStatus(err) === HTTP_NOT_FOUND) {
          setUnavailableId(current.id);
          return;
        }
        setError(errorText(err));
      },
    });
  };

  const handleCancel = () => {
    setError(null);
    cancelM.mutate(current.id, {
      onSuccess: (a) => {
        setOverride(a);
        onCancelled?.(a);
      },
      onError: (err) => {
        onError?.(err);
        if (errorStatus(err) === HTTP_GONE) {
          setOverride({ ...current, status: 'expired' });
          return;
        }
        if (errorStatus(err) === HTTP_NOT_FOUND) {
          setUnavailableId(current.id);
          return;
        }
        setError(errorText(err));
      },
    });
  };

  const sourceLabel = current.source === 'agent' ? S.sourceAgent : S.sourceDocextract;
  const kindLabel = current.kind === 'create' ? S.kindCreate : S.kindUpdate;
  const pending = current.status === 'pending' && !unavailable;

  return (
    <Card role="article" aria-labelledby={titleId} data-status={current.status}>
      <CardHeader>
        <CardTitle id={titleId}>{current.preview.title}</CardTitle>
        <CardDescription>{current.preview.summary}</CardDescription>
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-label">
          <span className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground">{sourceLabel}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{kindLabel}</span>
          {!pending && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
              {STATUS_LABEL[current.status as keyof typeof STATUS_LABEL]}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {current.preview.fields.length > 0 && (
          <dl aria-label={S.fieldsLabel} className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            {current.preview.fields.map((f, i) => (
              <div key={`${f.label}-${i}`} className="contents">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="text-foreground">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <p className="text-label text-muted-foreground">
          {current.status === 'expired' ? S.expiredPrefix : S.expiresPrefix}{' '}
          <time dateTime={current.expiresAt} title={absolute}>
            {relative}
          </time>
        </p>

        <div role="status" aria-live="polite" className="text-sm">
          {current.status === 'confirmed' && current.resultRef && (
            <p className="text-accent-foreground">
              {S.resultPrefix}{' '}
              {resultHref ? (
                <Link to={resultHref} className="underline">{current.resultRef.label}</Link>
              ) : (
                current.resultRef.label
              )}
              {replayed && <span className="text-muted-foreground"> {S.replayedNote}</span>}
            </p>
          )}
          {current.status === 'cancelled' && <p className="text-muted-foreground">{S.cancelledNote}</p>}
          {current.status === 'expired' && <p className="text-muted-foreground">{S.expiredNote}</p>}
          {unavailable && <p className="text-muted-foreground">{S.unavailable}</p>}
          {current.status === 'failed' && (
            <p className="text-destructive">{current.errorMessage || S.failedNote}</p>
          )}
        </div>

        <div role="alert" aria-live="assertive" className="text-sm text-destructive">
          {error}
        </div>
      </CardContent>

      {pending && (
        <CardFooter className="gap-2">
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={busy || Boolean(disabledReason)}
            aria-describedby={disabledReason ? reasonId : undefined}
            aria-busy={confirmM.isPending}
            aria-label={`${S.confirm}: ${current.preview.title}`}
          >
            {confirmM.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {confirmM.isPending ? S.working : S.confirm}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={busy}
            aria-busy={cancelM.isPending}
            aria-label={`${S.cancel}: ${current.preview.title}`}
          >
            {cancelM.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {cancelM.isPending ? S.working : S.cancel}
          </Button>
          {disabledReason && (
            <p id={reasonId} className="text-label text-muted-foreground">{disabledReason}</p>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
