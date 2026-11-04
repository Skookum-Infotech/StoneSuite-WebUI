import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/tenant/ui';
import {
  DELIVERY_STATUS_LABEL,
  documentLabel,
  documentLink,
  formatDeliveryTime,
  hasDeliveryError,
  stageText,
} from '@/lib/automationDeliveries';
import { deliveryReasonLabel } from '@/lib/deliveryReasons';
import { cn } from '@/lib/utils';
import type { AutomationDelivery, DeliveryStatus } from '@/types/automationDelivery';

export const DELIVERY_GRID =
  'md:grid md:grid-cols-[1fr_1fr_0.9fr_1.4fr_0.9fr_0.7fr_1.3fr_1fr_1fr_0.5fr] md:items-center md:gap-3';

const STATUS_CLASS: Readonly<Record<DeliveryStatus, string>> = {
  planned: '',
  claimed: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300',
  sent: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300',
  skipped: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
  failed: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300',
  dead: 'border-red-300 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200',
  unknown: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
};

interface Props {
  delivery: AutomationDelivery;
  ruleName: string;
  /** Length of the rule's cadence, when the rule is known. */
  cadenceLength: number | undefined;
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs text-stone-600 md:block dark:text-stone-300">
      <span className="text-2xs font-semibold uppercase text-stone-400 md:hidden">{label}</span>
      <span className="min-w-0 break-words text-right md:text-left">{children}</span>
    </div>
  );
}

/** One delivery: a card on phones, a grid row from md up; failed rows expand to show the error. */
export function DeliveryRow({ delivery: d, ruleName, cadenceLength }: Props) {
  const [open, setOpen] = useState(false);
  const link = documentLink(d);
  const label = documentLabel(d);
  const expandable = hasDeliveryError(d);
  return (
    <li className="border-b border-stone-100 last:border-b-0 dark:border-stone-800">
      <div className={cn('flex flex-col gap-1.5 p-4 md:py-3', DELIVERY_GRID)}>
        <Cell label="Created">{formatDeliveryTime(d.createdAt)}</Cell>
        <Cell label="Rule">{ruleName}</Cell>
        <Cell label="Document">
          {link ? (
            <Link to={link} className="font-medium text-brand-dark underline-offset-2 hover:underline">
              {label}
            </Link>
          ) : (
            label
          )}
        </Cell>
        <Cell label="Recipient">{d.recipientEmail || '—'}</Cell>
        <Cell label="Stage">{stageText(d.stage, cadenceLength)}</Cell>
        <Cell label="Status">
          <Badge size="sm" className={STATUS_CLASS[d.status]}>
            {DELIVERY_STATUS_LABEL[d.status] ?? d.status}
          </Badge>
        </Cell>
        <Cell label="Reason">{deliveryReasonLabel(d.reason) || '—'}</Cell>
        <Cell label="Scheduled for">{formatDeliveryTime(d.runAt)}</Cell>
        <Cell label="Sent at">{formatDeliveryTime(d.sentAt)}</Cell>
        <Cell label="Attempts">{d.attempts}</Cell>
      </div>
      {expandable && (
        <div className="px-4 pb-3">
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? 'Hide' : 'Show'} error for ${label}`}
            onClick={() => setOpen((v) => !v)}
            className="text-xs font-medium text-brand-dark underline-offset-2 hover:underline"
          >
            {open ? 'Hide error' : 'Show error'}
          </button>
          {open && (
            <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {d.lastError}
            </pre>
          )}
        </div>
      )}
    </li>
  );
}
