import { ChevronRight, ChevronDown, CheckCircle2, Circle, Lock, Unlock, Pencil, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fiscalYearDisplayLabel, type PeriodTreeRow as RowT } from '@/lib/accountingPeriodTree';
import {
  LOCK_DIMENSIONS, LOCK_STATUS_FIELDS, LOCK_TARGET_LABELS,
  type LockDimension, type LockTarget, type Period, type PeriodStatus,
} from '@/types/accountingPeriod';

function StatusIcon({ status }: { status: PeriodStatus }) {
  return status === 'closed'
    ? <CheckCircle2 className="mx-auto size-4 text-emerald-500" aria-hidden="true" />
    : <Circle className="mx-auto size-4 text-stone-300" aria-hidden="true" />;
}

function LockIcon({ status, lockedForever }: { status: PeriodStatus; lockedForever?: boolean }) {
  if (status === 'closed') {
    return <Lock className={cn('mx-auto size-4', lockedForever ? 'text-stone-400' : 'text-amber-500')} aria-hidden="true" />;
  }
  return <Unlock className="mx-auto size-4 text-stone-300" aria-hidden="true" />;
}

function AllowNonGlIcon() {
  // Always allowed — the closed-period guard in journal.CreateEntry only
  // covers G/L (journal) writes, never non-G/L record changes.
  return <Pencil className="mx-auto size-4 text-emerald-500" aria-hidden="true" />;
}

const actionCellCls =
  'mx-auto flex rounded p-0.5 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:hover:bg-transparent';

interface LockCellProps {
  period: Period;
  dimension: LockDimension;
  canUpdate: boolean;
  precedesBase: boolean;
  onOpen: (period: Period, target: LockTarget) => void;
}

// One sub-ledger lock cell on a month row. Each of the three is independently
// settable — that is what the backend's separate lock/unlock endpoints buy —
// so each gets its own button rather than mirroring the derived period status.
// A period that ends before the go-live boundary can never be unlocked on any
// dimension, so a closed lock there is permanent and the button is disabled.
function LockCell({ period, dimension, canUpdate, precedesBase, onOpen }: LockCellProps) {
  const status = period[LOCK_STATUS_FIELDS[dimension]];
  const locking = status === 'open';
  const frozen = precedesBase && status === 'closed';
  const label = LOCK_TARGET_LABELS[dimension];

  return (
    <td className="px-4 py-2">
      <button
        type="button"
        onClick={() => onOpen(period, dimension)}
        disabled={!canUpdate || frozen}
        aria-label={
          frozen
            ? `${label} for ${period.name} precedes the base period and cannot be unlocked`
            : `${locking ? 'Lock' : 'Unlock'} ${label} for ${period.name}`
        }
        title={
          frozen
            ? 'Precedes the base period — cannot be unlocked.'
            : `${locking ? 'Lock' : 'Unlock'} ${label}`
        }
        className={actionCellCls}
      >
        <LockIcon status={status} lockedForever={frozen} />
      </button>
    </td>
  );
}

interface PeriodTreeRowProps {
  row: RowT;
  basePeriodStart?: string;
  canUpdate: boolean;
  selectedIds: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
  onToggleSelect: (id: string) => void;
  onOpenStatusDialog: (period: Period, target: LockTarget) => void;
  onOpenHistory: (period: Period) => void;
}

// One row of the FY -> quarter -> month tree. Year/quarter rows show a rollup
// status (closed only when every period beneath them is closed, per column)
// and are not independently actionable — only a generated month is a closable
// unit. Column grid mirrors the reference tree: period name (with the expand
// toggle and tree indent), then the five status columns.
export function PeriodTreeRow({
  row, basePeriodStart, canUpdate, selectedIds, onToggleGroup, onToggleSelect, onOpenStatusDialog, onOpenHistory,
}: PeriodTreeRowProps) {
  if (row.level === 'year') {
    const { fiscalYear, locks } = row.node;
    return (
      <tr className="bg-stone-50/60 transition-colors hover:bg-stone-50">
        {canUpdate && <td className="px-3 py-2.5" />}
        <td className="px-4 py-2.5">
          <button
            type="button"
            onClick={() => onToggleGroup(row.key)}
            aria-expanded={!row.collapsed}
            aria-label={`${row.collapsed ? 'Expand' : 'Collapse'} ${fiscalYearDisplayLabel(fiscalYear.name)}`}
            className="flex items-center gap-1.5 font-bold text-stone-900"
          >
            {row.collapsed ? <ChevronRight className="size-3.5 text-stone-400" /> : <ChevronDown className="size-3.5 text-stone-400" />}
            {fiscalYearDisplayLabel(fiscalYear.name)}
          </button>
        </td>
        <td className="px-4 py-2.5"><StatusIcon status={fiscalYear.status} /></td>
        {LOCK_DIMENSIONS.map((d) => (
          <td key={d} className="px-4 py-2.5"><LockIcon status={locks[d]} /></td>
        ))}
        <td className="px-4 py-2.5"><AllowNonGlIcon /></td>
        <td className="px-4 py-2.5" />
      </tr>
    );
  }

  if (row.level === 'quarter') {
    const q = row.node;
    return (
      <tr className="transition-colors hover:bg-stone-50">
        {canUpdate && <td className="px-3 py-2" />}
        <td className="px-4 py-2 pl-8">
          <button
            type="button"
            onClick={() => onToggleGroup(row.key)}
            aria-expanded={!row.collapsed}
            aria-label={`${row.collapsed ? 'Expand' : 'Collapse'} ${q.label}`}
            className="flex items-center gap-1.5 font-semibold text-stone-700"
          >
            {row.collapsed ? <ChevronRight className="size-3.5 text-stone-400" /> : <ChevronDown className="size-3.5 text-stone-400" />}
            {q.label}
          </button>
        </td>
        <td className="px-4 py-2"><StatusIcon status={q.status} /></td>
        {LOCK_DIMENSIONS.map((d) => (
          <td key={d} className="px-4 py-2"><LockIcon status={q.locks[d]} /></td>
        ))}
        <td className="px-4 py-2"><AllowNonGlIcon /></td>
        <td className="px-4 py-2" />
      </tr>
    );
  }

  const { period } = row;
  const precedesBase = basePeriodStart !== undefined && new Date(period.end) < new Date(basePeriodStart);
  const lockedForever = period.status === 'closed' && precedesBase;
  const closing = period.status === 'open';

  return (
    <tr className="transition-colors hover:bg-stone-50">
      {canUpdate && (
        <td className="px-3 py-2">
          <input
            type="checkbox"
            checked={selectedIds.has(period.id)}
            onChange={() => onToggleSelect(period.id)}
            aria-label={`Select ${period.name}`}
            className="size-3.5 rounded border-stone-300"
          />
        </td>
      )}
      <td className="px-4 py-2 pl-14 text-stone-700">
        {period.name}
        {period.isBasePeriod && (
          <span className="ml-1.5 rounded bg-stone-100 px-1 py-0.5 text-2xs font-semibold text-stone-500">
            Base period
          </span>
        )}
      </td>
      <td className="px-4 py-2">
        <button
          type="button"
          onClick={() => onOpenStatusDialog(period, 'period')}
          disabled={!canUpdate || lockedForever}
          aria-label={
            lockedForever
              ? `${period.name} precedes the base period and cannot be reopened`
              : `${closing ? 'Close' : 'Reopen'} ${period.name}`
          }
          title={lockedForever ? 'Precedes the base period — cannot be reopened.' : closing ? 'Close period' : 'Reopen period'}
          className={actionCellCls}
        >
          <StatusIcon status={period.status} />
        </button>
      </td>
      {LOCK_DIMENSIONS.map((d) => (
        <LockCell
          key={d}
          period={period}
          dimension={d}
          canUpdate={canUpdate}
          precedesBase={precedesBase}
          onOpen={onOpenStatusDialog}
        />
      ))}
      <td className="px-4 py-2"><AllowNonGlIcon /></td>
      <td className="px-4 py-2">
        <button
          type="button"
          onClick={() => onOpenHistory(period)}
          aria-label={`View history for ${period.name}`}
          title="History"
          className="mx-auto flex rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
        >
          <History className="size-3.5" />
        </button>
      </td>
    </tr>
  );
}
