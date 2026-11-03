import { CheckCircle2, XCircle } from 'lucide-react';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { useBinTransferCustomFields } from '@/hooks/useBinTransferCustomFields';
import { formatDateValue, LIST_DATE_OPTIONS } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import type { BinTransfer } from '@/types/binTransfer';
import { BinTransferSlabsTable } from './BinTransferSlabsTable';

function ReadonlyField({ label, value, full }: { label: string; value?: string; full?: boolean }) {
  return (
    <div className={cn('space-y-1', full && 'col-span-full')}>
      <span className={fieldLabelCls}>{label}</span>
      <div className={readonlyCls}>{value || <span className="text-stone-500">—</span>}</div>
    </div>
  );
}

function fmtDate(iso?: string | null): string {
  return iso ? formatDateValue(iso, undefined, LIST_DATE_OPTIONS) : '';
}

function customValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value === undefined || value === null ? '' : String(value);
}

// The Overview tab: how the transfer ended (if it has), its details, and the
// slabs with where each was and is going.
export function BinTransferOverview({ transfer }: { transfer: BinTransfer }) {
  const customDefs = useBinTransferCustomFields();
  const pending = transfer.statusCode !== 'COMP' && transfer.statusCode !== 'CANC';

  return (
    <>
      {transfer.statusCode === 'COMP' && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <p className="text-xs text-emerald-800">
            Completed{transfer.completedByName ? ` by ${transfer.completedByName}` : ''}
            {transfer.completedAt ? ` on ${fmtDate(transfer.completedAt)}` : ''}. The {transfer.slabCount} slab
            {transfer.slabCount === 1 ? ' is' : 's are'} in {transfer.slabCount === 1 ? 'its' : 'their'} destination bin
            {transfer.slabCount === 1 ? '' : 's'}.
          </p>
        </div>
      )}
      {transfer.statusCode === 'CANC' && (
        <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-100 px-4 py-3">
          <XCircle className="mt-0.5 size-4 shrink-0 text-stone-500" aria-hidden="true" />
          <p className="text-xs text-stone-700">
            Cancelled{transfer.cancelledAt ? ` on ${fmtDate(transfer.cancelledAt)}` : ''}. Nothing was moved.
            {transfer.cancelReason && <> Reason: {transfer.cancelReason}</>}
          </p>
        </div>
      )}

      <ModernSection title="Transfer details" index={0}>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <ReadonlyField label="Location" value={transfer.warehouseName} />
          <ReadonlyField label="Date" value={fmtDate(transfer.date)} />
          <ReadonlyField label="Requested by" value={transfer.ownerName} />
          <ReadonlyField label="Destination" value={transfer.toBinSummary} />
          <ReadonlyField label="Slabs" value={`${transfer.slabCount} · ${transfer.totalArea.toFixed(2)} ${transfer.lines[0]?.areaUnitCode ?? ''}`.trim()} />
          {transfer.notes && <ReadonlyField label="Notes" value={transfer.notes} full />}
          {customDefs.map((def) => (
            <ReadonlyField key={def.id} label={def.label || def.key} value={customValue(transfer.customFields[def.key])} />
          ))}
        </div>
      </ModernSection>

      <ModernSection title={`Slabs (${transfer.lines.length})`} index={1}>
        <BinTransferSlabsTable lines={transfer.lines} pending={pending} />
      </ModernSection>
    </>
  );
}
