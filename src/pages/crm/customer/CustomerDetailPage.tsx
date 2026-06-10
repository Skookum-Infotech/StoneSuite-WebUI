import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Pencil } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { DeleteRecordDialog } from '@/components/crm/DeleteRecordDialog';
import { Section, FieldShell, TabBar } from '@/components/prospect/ProspectUI';
import { cn } from '@/lib/utils';
import { PRIMARY_SECTIONS, TABS } from '@/lib/customerForm';
import type { CustomerField, CustomerSection } from '@/lib/customerForm';
import type { StatusInfo } from '@/types/tenant';

export default function CustomerDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(TABS[0].key);

  const { data: record, isLoading, error } = useQuery({
    queryKey: ['crm-record', id],
    queryFn: () => crmService.getRecord(id, 'customer'),
    enabled: Boolean(id),
  });

  const { data: statusData } = useQuery({
    queryKey: ['crm-statuses-workflow', 'customer'],
    queryFn: () => crmService.getWorkflowStatuses('customer'),
  });

  const statusMap = new Map<string, StatusInfo>(
    (statusData?.statuses ?? []).map((s) => [s.stateId, s]),
  );

  if (isLoading) return <div className="p-6"><Spinner label="Loading customer…" /></div>;
  if (error || !record)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load customer.')}</ErrorNote></div>;

  const cf = record.coreFields;
  const company = String(cf.company_name ?? '(unnamed)');
  const statusInfo = statusMap.get(record.currentStateId);
  const activeTabObj = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  return (
    <div className="flex-1 flex flex-col bg-stone-50 min-h-0">

      {/* Sticky header */}
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/crm/customer')}
            className="flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800"
          >
            <ArrowLeft className="size-3.5" />
            Customers
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-stone-900">{company}</span>
            {statusInfo && <Badge color={statusInfo.color}>{statusInfo.statusLabel}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/crm/customer/${id}/edit`)}
            className="inline-flex items-center gap-1.5 rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            aria-label="Edit customer"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
          <DeleteRecordDialog
            recordId={id}
            workflowKey="customer"
            label={`Customer — ${company}`}
            onDeleted={() => {
              queryClient.invalidateQueries({ queryKey: ['crm-records', 'customer'] });
              navigate('/crm/customer');
            }}
          />
        </div>
      </div>

      {/* Page title */}
      <div className="bg-white border-b border-stone-100 px-6 py-2 flex items-center gap-2">
        <div className="h-5 w-5 rounded bg-emerald-100 flex items-center justify-center">
          <Building2 className="h-3 w-3 text-emerald-600" />
        </div>
        <h1 className="text-sm font-bold text-stone-800">Customer — {company}</h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

        {/* Primary sections */}
        {PRIMARY_SECTIONS.map((section) => (
          <ReadOnlySection key={section.title} section={section} data={cf} />
        ))}

        {/* Tabbed sections */}
        <div className="overflow-hidden rounded border border-stone-200 bg-white">
          <TabBar
            tabs={TABS.map((t) => ({ key: t.key, label: t.label }))}
            active={activeTabObj.key}
            onSelect={setActiveTab}
          />
          <div className="space-y-3 p-3">
            {activeTabObj.sections.map((section) => (
              <ReadOnlySection key={section.title} section={section} data={cf} />
            ))}
          </div>
        </div>

        {/* Dynamic custom fields */}
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
          Created {new Date(record.createdAt).toLocaleString()} ·{' '}
          Updated {new Date(record.updatedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function ReadOnlySection({
  section,
  data,
}: {
  section: CustomerSection;
  data: Record<string, unknown>;
}) {
  const visible = section.fields.filter((f) => {
    const v = data[f.key];
    return v !== undefined && v !== null && v !== '' && v !== false;
  });
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

function ReadOnlyField({ field, value }: { field: CustomerField; value: unknown }) {
  if (field.type === 'checkbox') {
    return (
      <FieldShell label={field.label}>
        <p className={cn('min-h-[1.5rem] text-xs font-medium', value ? 'text-emerald-700' : 'text-stone-400')}>
          {value ? 'Yes' : 'No'}
        </p>
      </FieldShell>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className="sm:col-span-2">
        <FieldShell label={field.label}>
          <p className="min-h-[1.5rem] whitespace-pre-wrap text-xs text-stone-800">
            {String(value ?? '—') || '—'}
          </p>
        </FieldShell>
      </div>
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
