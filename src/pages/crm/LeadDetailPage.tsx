import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Sparkles } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { DeleteRecordDialog } from '@/components/crm/DeleteRecordDialog';
import { ConvertRecordButton } from '@/components/crm/ConvertRecordButton';
import { Section, FieldShell } from '@/components/prospect/ProspectUI';
import { PRIMARY_SECTIONS, TABS } from '@/lib/leadForm';
import { LeadTabBar } from './AddLeadPage';
import { cn } from '@/lib/utils';
import type { LeadField, LeadSection } from '@/lib/leadForm';
import type { StatusInfo } from '@/types/tenant';

export default function LeadDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(TABS[0]?.key ?? '');

  const { data: record, isLoading, error } = useQuery({
    queryKey: ['crm-record', id],
    queryFn: () => crmService.getRecord(id, 'lead'),
    enabled: Boolean(id),
  });

  const { data: statusData } = useQuery({
    queryKey: ['crm-statuses-workflow', 'lead'],
    queryFn: () => crmService.getWorkflowStatuses('lead'),
  });

  const statusMap = new Map<string, StatusInfo>(
    (statusData?.statuses ?? []).map((s) => [s.stateId, s]),
  );

  if (isLoading) return <div className="p-6"><Spinner label="Loading lead…" /></div>;
  if (error || !record)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load lead.')}</ErrorNote></div>;

  const statusInfo = statusMap.get(record.currentStateId);
  const cf = record.coreFields;
  const company = String(cf.company_name ?? cf.first_name ?? '(unnamed)');
  const activeTabObj = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  return (
    <div className="flex-1 flex flex-col bg-stone-50 min-h-0">

      {/* Sticky header */}
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/crm/lead')}
            className="flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800"
          >
            <ArrowLeft className="size-3.5" />
            Leads
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-stone-900">{company}</span>
            {record.recordNumber && (
              <span className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono text-2xs text-stone-500">
                {record.recordNumber}
              </span>
            )}
            {statusInfo && <Badge color={statusInfo.color}>{statusInfo.statusLabel}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/crm/lead/${id}/edit`)}
            className="inline-flex items-center gap-1.5 rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            aria-label="Edit lead"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
          <ConvertRecordButton
            recordId={id}
            sourceWorkflowKey="lead"
            onConverted={(newId) => navigate(`/prospects/${newId}/edit`)}
          />
          <DeleteRecordDialog
            recordId={id}
            workflowKey="lead"
            label={`Lead — ${company}`}
            onDeleted={() => {
              queryClient.invalidateQueries({ queryKey: ['crm-records', 'lead'] });
              navigate('/crm/lead');
            }}
          />
        </div>
      </div>

      {/* Page title */}
      <div className="bg-white border-b border-stone-100 px-6 py-2 flex items-center gap-2">
        <div className="h-5 w-5 rounded bg-purple-100 flex items-center justify-center">
          <Sparkles className="h-3 w-3 text-purple-600" />
        </div>
        <h1 className="text-sm font-bold text-stone-800">Lead — {company}</h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {PRIMARY_SECTIONS.map((section) => (
          <ReadOnlySectionFields key={section.title} section={section} data={cf} />
        ))}

        <div className="rounded border border-stone-200 bg-white overflow-hidden">
          <LeadTabBar tabs={TABS} active={activeTabObj.key} onSelect={setActiveTab} />
          <div className="px-4 py-4">
            {activeTabObj.sections.length > 0 ? (
              <div className="space-y-3">
                {activeTabObj.sections.map((section) => (
                  <ReadOnlySectionFields key={section.title} section={section} data={cf} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-400 py-4 text-center">
                {activeTabObj.label} information is not available for this record.
              </p>
            )}
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
  section: LeadSection;
  data: Record<string, unknown>;
}) {
  const visible = section.fields.filter(
    (f) => f.type !== 'type_toggle' && (!f.showWhen || data[f.showWhen.key] === f.showWhen.value),
  );
  if (visible.length === 0) return null;
  return (
    <Section title={section.title}>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((f) => (
          <ReadOnlyField key={f.key} field={f} value={data[f.key]} />
        ))}
      </div>
    </Section>
  );
}

function ReadOnlyField({ field, value }: { field: LeadField; value: unknown }) {
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
