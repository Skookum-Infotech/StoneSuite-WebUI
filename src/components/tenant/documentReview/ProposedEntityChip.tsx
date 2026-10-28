import * as React from 'react';
import { useId, useState } from 'react';
import { AxiosError } from 'axios';
import { Building2, CheckCircle2, LoaderCircle, Package, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProposedActionCard } from '@/components/proposedAction/ProposedActionCard';
import { ExtractionApiError } from '@/services/documentExtractionService';
import { extractionQueryKey, useProposeEntity } from '@/hooks/useProposeEntity';
import { useQueryClient } from '@tanstack/react-query';
import type { ProposedEntityKind, ProposedEntityView, ProposeEntityOverrides } from '@/types/documentExtraction';
import type { ProposedAction, ProposedActionResultRef } from '@/types/proposedAction';
import { CONFIDENCE_LABEL, KIND_LABEL, PROPOSED_ENTITY_STRINGS as S } from './proposedEntityStrings';

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE = 422;
const CENTS_PER_DOLLAR = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const KIND_ICON: Record<ProposedEntityKind, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  customer: Building2,
  vendor: Truck,
  item: Package,
};

interface ProposedEntityChipProps {
  extractionId: string;
  entity: ProposedEntityView;
  /** Called once the record exists, so the review form can select it. */
  onCreated: (entity: ProposedEntityView, ref: ProposedActionResultRef) => void;
  className?: string;
}

function statusOf(err: unknown): number | undefined {
  if (err instanceof ExtractionApiError) return err.status;
  return err instanceof AxiosError ? err.response?.status : undefined;
}

function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : S.genericError;
}

/** Details of the proposed record as label/value pairs (all rendered as text). */
function detailRows(entity: ProposedEntityView): Array<[string, string]> {
  const f = entity.fields;
  const rows: Array<[string, string]> = [];
  if (f.address) rows.push([S.address, f.address]);
  if (f.taxId) rows.push([S.taxId, f.taxId]);
  if (f.sku) rows.push([S.sku, f.sku]);
  if (f.description) rows.push([S.description, f.description]);
  if (f.uom) rows.push([S.uom, f.uom]);
  if (f.unitPriceCents !== undefined) rows.push([S.unitPrice, `$${(f.unitPriceCents / CENTS_PER_DOLLAR).toFixed(2)}`]);
  return rows;
}

function sourceText(entity: ProposedEntityView): string {
  const { page, row } = entity.source;
  const parts: string[] = [];
  if (page !== undefined) parts.push(`${S.page} ${page}`);
  if (row !== undefined) parts.push(`${S.row} ${row}`);
  return parts.join(', ');
}

/** The newer of a locally returned proposal and the one on the extraction. */
function latestAction(local: ProposedAction | null, server: ProposedAction | undefined): ProposedAction | undefined {
  if (!local) return server;
  if (!server || server.id === local.id) return server ?? local;
  return new Date(local.createdAt).getTime() >= new Date(server.createdAt).getTime() ? local : server;
}

/** One unmatched customer/vendor/item offered as a new record: what was read,
 *  the inputs it needs, and the propose -> confirm path to create it. */
export function ProposedEntityChip({ extractionId, entity, onCreated, className }: ProposedEntityChipProps): React.JSX.Element {
  const uid = useId();
  const qc = useQueryClient();
  const propose = useProposeEntity(extractionId);
  const [email, setEmail] = useState('');
  const [sku, setSku] = useState(entity.fields.sku ?? '');
  const [touched, setTouched] = useState(false);
  const [localAction, setLocalAction] = useState<ProposedAction | null>(null);
  const [created, setCreated] = useState<ProposedActionResultRef | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState('');

  const needsEmail = entity.needs?.includes('contactEmail') ?? false;
  const needsSku = entity.needs?.includes('sku') ?? false;
  const emailOk = !needsEmail || EMAIL_PATTERN.test(email.trim());
  const skuOk = !needsSku || sku.trim() !== '';
  const inputsValid = emailOk && skuOk;

  const action = latestAction(localAction, entity.action);
  const Icon = KIND_ICON[entity.kind];
  const noun = KIND_LABEL[entity.kind];
  const rows = detailRows(entity);
  const source = sourceText(entity);
  const blockedReason = !entity.canCreate ? (entity.reason ?? S.noPermission) : forbidden ? S.noPermission : '';
  const reasonId = `${uid}-reason`;
  const refreshExtraction = () => { void qc.invalidateQueries({ queryKey: extractionQueryKey(extractionId) }); };

  const createdRef = created ?? (action?.status === 'confirmed' ? action.resultRef ?? null : null);

  const onPropose = () => {
    setTouched(true);
    if (!inputsValid || blockedReason) return;
    setError('');
    const overrides: ProposeEntityOverrides = {};
    if (needsEmail) overrides.contactEmail = email.trim();
    if (needsSku) overrides.sku = sku.trim();
    propose.mutate(
      { key: entity.key, overrides: Object.keys(overrides).length > 0 ? overrides : undefined },
      {
        onSuccess: (a) => setLocalAction(a),
        onError: (err) => {
          const status = statusOf(err);
          if (status === HTTP_FORBIDDEN) setForbidden(true);
          else if (status === HTTP_NOT_FOUND) setGone(true);
          else if (status === HTTP_CONFLICT) setError(S.notReady);
          else if (status === HTTP_UNPROCESSABLE) setError(messageOf(err));
          else setError(S.genericError);
        },
      },
    );
  };

  const onCardError = (err: unknown) => {
    const status = statusOf(err);
    if (status === HTTP_FORBIDDEN) setForbidden(true);
    else if (status === HTTP_NOT_FOUND) setGone(true);
    else if (status === HTTP_UNPROCESSABLE) refreshExtraction();
  };

  let body: React.ReactNode;
  if (gone) {
    body = <p>{S.unavailable}</p>;
  } else if (createdRef) {
    body = (
      <p className="flex items-center gap-1.5 font-medium text-accent-foreground">
        <CheckCircle2 className="size-3.5" aria-hidden={true} />
        {S.createdPrefix} {createdRef.label}
      </p>
    );
  } else if (action?.status === 'failed') {
    body = <p className="text-destructive">{`“${entity.name}” ${S.failed}`}</p>;
  } else if (action?.status === 'pending') {
    body = (
      <ProposedActionCard
        action={action}
        disabledReason={blockedReason || undefined}
        onError={onCardError}
        onConfirmResult={(res) => {
          const ref = res.action.resultRef;
          if (!ref) { refreshExtraction(); return; }
          setCreated(ref);
          onCreated(entity, ref);
          refreshExtraction();
        }}
        onCancelled={refreshExtraction}
      />
    );
  } else {
    const again = action?.status === 'expired' || action?.status === 'cancelled';
    body = (
      <div className="space-y-2">
        {again && <p className="text-muted-foreground">{action?.status === 'expired' ? S.expiredNote : S.cancelledNote}</p>}
        {needsEmail && (
          <div className="space-y-1">
            <Label htmlFor={`${uid}-email`}>{S.emailLabel}</Label>
            <Input
              id={`${uid}-email`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={Boolean(blockedReason)}
              aria-invalid={touched && !emailOk}
              aria-describedby={touched && !emailOk ? `${uid}-email-err` : undefined}
            />
            {touched && !emailOk && <p id={`${uid}-email-err`} className="text-destructive">{S.emailInvalid}</p>}
          </div>
        )}
        {needsSku && (
          <div className="space-y-1">
            <Label htmlFor={`${uid}-sku`}>{S.skuLabel}</Label>
            <Input
              id={`${uid}-sku`}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              disabled={Boolean(blockedReason)}
              aria-invalid={touched && !skuOk}
              aria-describedby={touched && !skuOk ? `${uid}-sku-err` : undefined}
            />
            {touched && !skuOk && <p id={`${uid}-sku-err`} className="text-destructive">{S.skuInvalid}</p>}
          </div>
        )}
        <Button
          type="button"
          size="sm"
          onClick={onPropose}
          disabled={propose.isPending || Boolean(blockedReason) || !inputsValid}
          aria-busy={propose.isPending}
          aria-describedby={blockedReason ? reasonId : undefined}
        >
          {propose.isPending && <LoaderCircle className="animate-spin" aria-hidden={true} />}
          {propose.isPending ? S.working : again ? `${S.proposeAgain}: ${noun} “${entity.name}”` : `${S.create} ${noun} “${entity.name}”…`}
        </Button>
        {blockedReason && <p id={reasonId} className="text-muted-foreground">{blockedReason}</p>}
      </div>
    );
  }

  return (
    <li
      data-proposed-entity={entity.key}
      className={`list-none space-y-1.5 rounded-lg border border-dashed border-border bg-muted/40 p-2.5 text-xs ${className ?? ''}`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Icon className="size-3.5 text-muted-foreground" aria-hidden={true} />
        <span className="font-semibold text-foreground">{noun}: {entity.name}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-label text-muted-foreground">{CONFIDENCE_LABEL[entity.confidence]}</span>
        {source && <span className="text-label text-muted-foreground">{source}</span>}
      </div>
      {rows.length > 0 && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div role="status" aria-live="polite">{body}</div>
      <div role="alert" className="text-destructive">{error}</div>
    </li>
  );
}
