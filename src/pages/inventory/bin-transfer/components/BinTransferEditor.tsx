import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeftRight, Loader2, Save } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryBinService } from '@/services/inventoryBinService';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { useBinTransferCustomFields } from '@/hooks/useBinTransferCustomFields';
import { useScrollToError } from '@/hooks/useScrollToError';
import { FormActionBar, ModernFieldShell, ModernSection } from '@/components/crm/FormPrimitives';
import { fieldCls } from '@/components/crm/formUtils';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { WarehouseSelect } from '@/components/inventory/WarehouseSelect';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { coerceCustomFields } from '@/lib/customFields';
import { defaultWarehouseUuid, toNumericWarehouseId, toWarehouseUuid } from '@/lib/inventoryWarehouse';
import {
  draftLineFromRecord, summarizeDraft, toLineInputs, validateDraft, type BinTransferDraftLine,
} from '@/lib/binTransferLines';
import type { BinTransferInput, BinTransferRecord } from '@/types/binTransfer';
import { BinTransferLinesEditor } from './BinTransferLinesEditor';

const TODAY = () => new Date().toISOString().split('T')[0];

// One form for New and Edit. The page owns the save call and where to go next;
// this owns the draft (location, date, notes, slabs and their destinations,
// custom fields) and the checks the server would otherwise have to refuse.
export function BinTransferEditor({ initial, copy, onSubmit, status, onCancel }: {
  initial?: BinTransferRecord;
  copy: { title: string; subtitle: string; backLabel: string; submitLabel: string };
  onSubmit: (input: BinTransferInput) => void;
  status: { isPending: boolean; error: unknown };
  onCancel: () => void;
}) {
  const { lookups } = useInventoryLookups();
  const warehouses = lookups?.warehouses ?? [];
  const customDefs = useBinTransferCustomFields();

  // Derived rather than copied into state: the lookups arrive after mount, and
  // once the user has picked a location a later refetch must not overwrite it.
  const [pickedLocation, setPickedLocation] = useState<string | null>(null);
  const initialLocation = initial ? toWarehouseUuid(warehouses, initial.warehouseId) : defaultWarehouseUuid(warehouses);
  const locationUuid = pickedLocation ?? initialLocation;

  const [date, setDate] = useState(initial?.date || TODAY());
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [lines, setLines] = useState<BinTransferDraftLine[]>(() => (initial?.lines ?? []).map(draftLineFromRecord));
  const [customValues, setCustomValues] = useState<Record<string, unknown>>(initial?.customFields ?? {});
  const [fieldError, setFieldError] = useState<string | null>(null);

  const { data: bins = [] } = useQuery({
    queryKey: ['inventory-bins-tree', locationUuid],
    queryFn: () => inventoryBinService.getTree(locationUuid),
    enabled: Boolean(locationUuid),
  });

  const warehouseId = toNumericWarehouseId(warehouses, locationUuid);
  const summary = summarizeDraft(lines);
  const errorRef = useScrollToError<HTMLDivElement>(status.error || fieldError);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateDraft(lines, locationUuid);
    if (problem) {
      setFieldError(problem);
      return;
    }
    setFieldError(null);
    onSubmit({
      warehouseId,
      date,
      notes,
      customFields: coerceCustomFields(customDefs, customValues),
      lines: toLineInputs(lines),
    });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel={copy.backLabel}
          onBack={onCancel}
          icon={ArrowLeftRight}
          title={copy.title}
          subtitle={copy.subtitle}
          recordNumber={initial?.number}
          actions={(
            <button
              type="submit"
              disabled={status.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 shadow-sm transition-all hover:bg-brand-hover disabled:opacity-50"
            >
              {status.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {status.isPending ? 'Saving…' : copy.submitLabel}
            </button>
          )}
        />

        {(status.error || fieldError) && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-inset"
          >
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {fieldError || apiErrorMessage(status.error, 'Failed to save the bin transfer.')}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-4 py-3 pb-24 space-y-2 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">
            <ModernSection title="Details" index={0}>
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <ModernFieldShell label="Location" required>
                  <WarehouseSelect
                    warehouses={warehouses}
                    value={locationUuid}
                    onChange={setPickedLocation}
                    required
                    className={lines.length > 0 ? 'cursor-not-allowed bg-stone-50' : undefined}
                  />
                  {lines.length > 0 && (
                    <p className="mt-1 text-2xs text-stone-400">Remove every slab to change the location.</p>
                  )}
                </ModernFieldShell>
                <ModernFieldShell label="Date" required>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldCls} aria-label="Transfer date" required />
                </ModernFieldShell>
                <div className="sm:col-span-2 lg:col-span-3">
                  <ModernFieldShell label="Notes">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Why these slabs are moving — shown to the approvers."
                      className={`${fieldCls} h-auto resize-none`}
                      aria-label="Notes"
                    />
                  </ModernFieldShell>
                </div>
              </div>
            </ModernSection>

            <ModernSection title="Slabs to move" index={1}>
              <div className="space-y-3">
                {summary.count > 0 && (
                  <p className="text-xs text-stone-500" aria-live="polite">
                    <span className="font-semibold text-stone-800">{summary.count} slab{summary.count === 1 ? '' : 's'}</span>
                    {' · '}{summary.totalArea.toFixed(2)} {summary.areaUnitCode}
                    {summary.destinations > 0 && ` · ${summary.destinations} destination bin${summary.destinations === 1 ? '' : 's'}`}
                  </p>
                )}
                <BinTransferLinesEditor
                  lines={lines}
                  onChange={setLines}
                  bins={bins}
                  warehouseId={warehouseId}
                  locationChosen={warehouseId > 0}
                />
              </div>
            </ModernSection>

            {customDefs.length > 0 && (
              <ModernSection title="Custom fields" index={2}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  {customDefs.map((def) => (
                    <DynamicFieldInput
                      key={def.id}
                      field={def}
                      value={customValues[def.key]}
                      onChange={(key, value) => setCustomValues((prev) => ({ ...prev, [key]: value }))}
                    />
                  ))}
                </div>
              </ModernSection>
            )}
          </div>
        </div>

        <FormActionBar onCancel={onCancel} isPending={status.isPending} submitLabel={copy.submitLabel} />
      </form>
    </div>
  );
}
