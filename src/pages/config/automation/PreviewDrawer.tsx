import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { PREVIEW_EXISTING_KEY, PREVIEW_PLANNED_KEY, previewSkipLabel } from '@/lib/automationCopy';
import { automationRuleService } from '@/services/automationRuleService';
import type { AutomationRule } from '@/types/automationRule';
import type { AutomationPreview } from '@/types/automationPreview';

interface Props {
  rule: AutomationRule;
  onClose: () => void;
}

const INVOICE_PATH = '/sales/invoice';
const NOTHING_PLANNED = 'No reminders would be sent right now.';
const PREVIEW_FOOTER = 'Preview only. Nothing was sent.';

function countRows(counts: AutomationPreview['counts']): Array<[string, number]> {
  const rows: Array<[string, number]> = [
    ['Planned', counts[PREVIEW_PLANNED_KEY] ?? 0],
    ['Already handled', counts[PREVIEW_EXISTING_KEY] ?? 0],
  ];
  for (const [reason, n] of Object.entries(counts)) {
    if (reason !== PREVIEW_PLANNED_KEY && reason !== PREVIEW_EXISTING_KEY && n > 0) {
      rows.push([`Skipped: ${previewSkipLabel(reason)}`, n]);
    }
  }
  return rows;
}

function PreviewBody({ preview }: { preview: AutomationPreview }) {
  const nothing = (preview.counts[PREVIEW_PLANNED_KEY] ?? 0) === 0 && preview.recipients.length === 0;
  return (
    <>
      {nothing && <p className="text-sm text-stone-600">{NOTHING_PLANNED}</p>}
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
        {countRows(preview.counts).map(([label, n]) => (
          <div key={label} className="contents">
            <dt className="text-stone-600">{label}</dt>
            <dd className="text-right font-semibold text-stone-900">{n}</dd>
          </div>
        ))}
      </dl>
      {preview.recipients.length > 0 && (
        <ul aria-label="Recipients" className="mt-4 divide-y divide-stone-100 rounded-lg border border-stone-200">
          {preview.recipients.map((r) => (
            <li key={r.email} className="p-3 text-xs">
              <p className="font-medium text-stone-900">{r.email}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {r.items.map((item) => (
                  <Link
                    key={`${item.invoiceUuid}-${item.stage}`}
                    to={`${INVOICE_PATH}/${item.invoiceUuid}`}
                    className="font-medium text-brand-dark underline-offset-2 hover:underline"
                  >
                    {item.number}
                  </Link>
                ))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Right-hand drawer showing the dry run for a rule: who would be emailed right now. */
export function PreviewDrawer({ rule, onClose }: Props) {
  const preview = useQuery({
    queryKey: ['automation-preview', rule.ruleKey],
    queryFn: () => automationRuleService.preview(rule.ruleKey),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9999] bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-[10000] flex w-full max-w-md flex-col bg-white shadow-2xl dark:bg-stone-900"
        >
          <div className="flex items-start justify-between gap-3 border-b border-stone-200 p-4">
            <Dialog.Title className="text-sm font-bold text-stone-900">Preview: {rule.name}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close preview" className="rounded p-1 text-stone-500 hover:bg-stone-100">
                <X className="size-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {preview.isLoading && <Spinner />}
            {preview.isError && <ErrorNote>{apiErrorMessage(preview.error, 'Could not load the preview.')}</ErrorNote>}
            {preview.data && <PreviewBody preview={preview.data} />}
          </div>
          <p className="border-t border-stone-200 p-4 text-xs text-stone-500">{PREVIEW_FOOTER}</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
