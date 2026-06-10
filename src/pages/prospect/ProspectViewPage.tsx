import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { DeleteRecordDialog } from '@/components/crm/DeleteRecordDialog';
import { Section, FieldShell } from '@/components/prospect/ProspectUI';
import type { StatusInfo } from '@/types/tenant';

export default function ProspectViewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: record, isLoading, error } = useQuery({
    queryKey: ['crm-record', id],
    queryFn: () => crmService.getRecord(id),
    enabled: Boolean(id),
  });

  const { data: statusData } = useQuery({
    queryKey: ['crm-statuses-workflow', 'prospect'],
    queryFn: () => crmService.getWorkflowStatuses('prospect'),
  });

  const statusMap = new Map<string, StatusInfo>(
    (statusData?.statuses ?? []).map((s) => [s.stateId, s]),
  );

  const statusInfo = record ? statusMap.get(record.currentStateId) : undefined;
  const company = String(record?.coreFields.company_name ?? '(unnamed prospect)');

  return (
    <div className="flex-1 bg-stone-50 p-6">
      <button
        type="button"
        onClick={() => navigate('/prospects')}
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800"
      >
        <ArrowLeft className="size-3.5" /> Prospects
      </button>

      {isLoading && <Spinner label="Loading prospect…" />}
      {error && <ErrorNote>{apiErrorMessage(error, 'Failed to load prospect.')}</ErrorNote>}

      {record && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-bold text-stone-900">{company}</h1>
              {statusInfo && <Badge color={statusInfo.color}>{statusInfo.statusLabel}</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(`/prospects/${id}/edit`)}
                className="inline-flex items-center gap-1.5 rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                <Pencil className="size-3.5" /> Edit
              </button>
              <DeleteRecordDialog
                recordId={id}
                label={`Prospect — ${company}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['crm-records', 'prospect'] });
                  navigate('/prospects');
                }}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Section title="Prospect Details">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Company Name', 'company_name'],
                  ['Email', 'email'],
                  ['Phone', 'phone'],
                  ['Deal Size', 'deal_size'],
                  ['Expected Close Date', 'close_date'],
                ].map(([label, key]) => (
                  <FieldShell key={key} label={label}>
                    <p className="min-h-[1.5rem] text-xs text-stone-800">
                      {String(record.coreFields[key] ?? '—') || '—'}
                    </p>
                  </FieldShell>
                ))}
              </div>
            </Section>

            {Object.keys(record.customFields).length > 0 && (
              <Section title="Custom Fields">
                <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(record.customFields).map(([key, value]) => (
                    <FieldShell key={key} label={key}>
                      <p className="min-h-[1.5rem] text-xs text-stone-800">
                        {String(value ?? '—') || '—'}
                      </p>
                    </FieldShell>
                  ))}
                </div>
              </Section>
            )}

            <div className="text-2xs text-stone-400">
              Created {new Date(record.createdAt).toLocaleString()} ·
              Updated {new Date(record.updatedAt).toLocaleString()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
