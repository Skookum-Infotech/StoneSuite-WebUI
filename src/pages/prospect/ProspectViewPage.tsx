import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Users } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { DeleteRecordDialog } from '@/components/crm/DeleteRecordDialog';
import { ConvertRecordButton } from '@/components/crm/ConvertRecordButton';
import { Section, FieldShell, TabBar } from '@/components/prospect/ProspectUI';
import { PRIMARY_SECTIONS, TABS } from '@/lib/prospectForm';
import { cn } from '@/lib/utils';
import type { ProspectField, ProspectSection } from '@/lib/prospectForm';
import type { StatusInfo } from '@/types/tenant';

export default function ProspectViewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(TABS[0]?.key ?? '');

  const { data: record, isLoading, error } = useQuery({
    queryKey: ['crm-record', id],
    queryFn: () => crmService.getRecord(id, 'prospect'),
    enabled: Boolean(id),
  });

  const { data: statusData } = useQuery({
    queryKey: ['crm-statuses-workflow', 'prospect'],
    queryFn: () => crmService.getWorkflowStatuses('prospect'),
  });

  const statusMap = new Map<string, StatusInfo>(
    (statusData?.statuses ?? []).map((s) => [s.stateId, s]),
  );

  if (isLoading) return <div className="p-6"><Spinner label="Loading prospect…" /></div>;
  if (error || !record)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load prospect.')}</ErrorNote></div>;

  const statusInfo = statusMap.get(record.currentStateId);
  const cf = record.coreFields;
  const company = String(cf.company_name ?? '(unnamed prospect)');
  const activeTabObj = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  return (
    <div className="flex-1 flex flex-col bg-stone-50 min-h-0">

      {/* Sticky header */}
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/prospects')}
            className="flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800"
          >
            <ArrowLeft className="size-3.5" />
            Prospects
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-stone-900">{company}</span>
            {statusInfo && <Badge color={statusInfo.color}>{statusInfo.statusLabel}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/prospects/${id}/edit`)}
            className="inline-flex items-center gap-1.5 rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            aria-label="Edit prospect"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
          <ConvertRecordButton
            recordId={id}
            sourceWorkflowKey="prospect"
            onConverted={(newId) => navigate(`/crm/customer/${newId}/edit`)}
          />
          <DeleteRecordDialog
            recordId={id}
            workflowKey="prospect"
            label={`Prospect — ${company}`}
            onDeleted={() => {
              queryClient.invalidateQueries({ queryKey: ['crm-records', 'prospect'] });
              navigate('/prospects');
            }}
          />
        </div>
      </div>

      {/* Page title */}
      <div className="bg-white border-b border-stone-100 px-6 py-2 flex items-center gap-2">
        <div className="h-5 w-5 rounded bg-brand/20 flex items-center justify-center">
          <Users className="h-3 w-3 text-brand-dark" />
        </div>
        <h1 className="text-sm font-bold text-stone-800">Prospect — {company}</h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {PRIMARY_SECTIONS.map((section) => (
          <ReadOnlySectionFields key={section.title} section={section} data={cf} />
        ))}

        <div className="rounded border border-stone-200 bg-white overflow-hidden">
          <TabBar tabs={TABS} active={activeTabObj.key} onSelect={setActiveTab} />
          <div className="space-y-3 p-3">
            {activeTabObj.sections.map((section) => (
              <ReadOnlySectionFields key={section.title} section={section} data={cf} />
            ))}
          </div>
        </div>

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

        <p className="text-2xs text-stone-400">
          Created {new Date(record.createdAt).toLocaleString()} ·
          Updated {new Date(record.updatedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function ReadOnlySectionFields({
  section,
  data,
}: {
  section: ProspectSection;
  data: Record<string, unknown>;
}) {
  return (
    <Section title={section.title}>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {section.fields.map((f) => (
          <ReadOnlyField key={f.key} field={f} value={data[f.key]} />
        ))}
      </div>
    </Section>
  );
}

function ReadOnlyField({ field, value }: { field: ProspectField; value: unknown }) {
  if (field.type === 'checkbox') {
    return (
      <FieldShell label={field.label}>
        <p className={cn('min-h-[1.5rem] text-xs font-medium', value === true ? 'text-brand-dark' : 'text-stone-400')}>
          {value === true ? 'Yes' : 'No'}
        </p>
      </FieldShell>
    );
  }
  return (
    <FieldShell label={field.label}>
      <p className="min-h-[1.5rem] text-xs text-stone-800">
        {String(value ?? '—') || '—'}
      </p>
    </FieldShell>
  );
}
